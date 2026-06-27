import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { logger } from "../utils/logger";

interface PendingRegistrationEmail {
    customerEmail: string;
    customerName?: string | null;
    tenantName?: string | null;
}

interface AdminRegistrationNotificationEmail extends PendingRegistrationEmail {
    tenantInviteCode?: string | null;
}

interface ApprovalEmail {
    customerEmail: string;
    customerName?: string | null;
    tenantName?: string | null;
}

interface RejectionEmail extends ApprovalEmail {
    rejectionReason?: string | null;
}

interface MailMessage {
    to: string | string[];
    subject: string;
    text: string;
    html: string;
}

function splitEmails(value?: string): string[] {
    if (!value) {
        return [];
    }

    return value
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function greeting(name?: string | null): string {
    const trimmed = name?.trim();
    return trimmed ? `Hi ${trimmed},` : "Hi,";
}

class GmailEmailService {
    private transporter: Transporter | null = null;

    private warnedMissingConfig = false;

    private get gmailUser(): string | undefined {
        return process.env.GMAIL_USER?.trim() || undefined;
    }

    private get gmailAppPassword(): string | undefined {
        return process.env.GMAIL_APP_PASSWORD?.trim() || undefined;
    }

    private get fromName(): string {
        return process.env.EMAIL_FROM_NAME?.trim() || "SentryX";
    }

    private get supportEmail(): string | undefined {
        return process.env.SUPPORT_EMAIL?.trim() || this.gmailUser;
    }

    private get customerLoginUrl(): string | undefined {
        return process.env.CUSTOMER_APP_LOGIN_URL?.trim() || undefined;
    }

    private get adminAppUrl(): string | undefined {
        return process.env.ADMIN_APP_URL?.trim() || undefined;
    }

    private get superAdminEmails(): string[] {
        return splitEmails(process.env.SUPER_ADMIN_EMAILS);
    }

    private getTransporter(): Transporter | null {
        const user = this.gmailUser;
        const pass = this.gmailAppPassword;

        if (!user || !pass) {
            if (!this.warnedMissingConfig) {
                this.warnedMissingConfig = true;
                logger.warn("Email sending disabled: missing Gmail configuration", {
                    category: "EMAIL",
                    action: "EMAIL_CONFIG_MISSING",
                    status: "SKIPPED",
                    context: "EmailService",
                    metadata: {
                        hasGmailUser: Boolean(user),
                        hasGmailAppPassword: Boolean(pass)
                    }
                });
            }
            return null;
        }

        if (!this.transporter) {
            this.transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 587,
                secure: false,
                auth: {
                    user,
                    pass
                }
            });
        }

        return this.transporter;
    }

    private async send(message: MailMessage, action: string): Promise<void> {
        const transporter = this.getTransporter();
        if (!transporter) {
            return;
        }

        const fromAddress = this.gmailUser;
        if (!fromAddress) {
            return;
        }

        try {
            await transporter.sendMail({
                from: `"${this.fromName}" <${fromAddress}>`,
                ...message
            });

            logger.info("Email sent", {
                category: "EMAIL",
                action,
                status: "SUCCESS",
                context: "EmailService",
                metadata: {
                    to: Array.isArray(message.to) ? message.to : [message.to],
                    subject: message.subject
                }
            });
        } catch (error) {
            logger.error("Email send failed", error, {
                category: "EMAIL",
                action,
                status: "FAILED",
                context: "EmailService",
                metadata: {
                    to: Array.isArray(message.to) ? message.to : [message.to],
                    subject: message.subject
                }
            });
        }
    }

    async sendCustomerRegistrationConfirmation(payload: PendingRegistrationEmail): Promise<void> {
        const tenantName = payload.tenantName || "your organization";
        const supportLine = this.supportEmail ? `If you need help, contact ${this.supportEmail}.` : "";

        await this.send({
            to: payload.customerEmail,
            subject: "Your SentryX registration is pending approval",
            text: [
                greeting(payload.customerName),
                "",
                `Your registration request for ${tenantName} was submitted successfully and is pending SentryX admin approval.`,
                "We will email you when the review is complete.",
                supportLine
            ].filter(Boolean).join("\n"),
            html: `
                <p>${escapeHtml(greeting(payload.customerName))}</p>
                <p>Your registration request for <strong>${escapeHtml(tenantName)}</strong> was submitted successfully and is pending SentryX admin approval.</p>
                <p>We will email you when the review is complete.</p>
                ${supportLine ? `<p>${escapeHtml(supportLine)}</p>` : ""}
            `
        }, "CUSTOMER_REGISTRATION_CONFIRMATION");
    }

    async sendSuperAdminRegistrationNotification(payload: AdminRegistrationNotificationEmail): Promise<void> {
        const recipients = this.superAdminEmails;
        if (recipients.length === 0) {
            logger.warn("Skipping super admin registration notification: no recipients configured", {
                category: "EMAIL",
                action: "SUPER_ADMIN_REGISTRATION_NOTIFICATION",
                status: "SKIPPED",
                context: "EmailService"
            });
            return;
        }

        const tenantName = payload.tenantName || "Unknown organization";
        const adminLink = this.adminAppUrl ? `Review requests: ${this.adminAppUrl}` : "";

        await this.send({
            to: recipients,
            subject: "New SentryX registration request",
            text: [
                "A new customer registration request is waiting for approval.",
                "",
                `Customer: ${payload.customerName || payload.customerEmail}`,
                `Email: ${payload.customerEmail}`,
                `Organization: ${tenantName}`,
                payload.tenantInviteCode ? `Organization ID: ${payload.tenantInviteCode}` : "",
                adminLink
            ].filter(Boolean).join("\n"),
            html: `
                <p>A new customer registration request is waiting for approval.</p>
                <ul>
                    <li><strong>Customer:</strong> ${escapeHtml(payload.customerName || payload.customerEmail)}</li>
                    <li><strong>Email:</strong> ${escapeHtml(payload.customerEmail)}</li>
                    <li><strong>Organization:</strong> ${escapeHtml(tenantName)}</li>
                    ${payload.tenantInviteCode ? `<li><strong>Organization ID:</strong> ${escapeHtml(payload.tenantInviteCode)}</li>` : ""}
                </ul>
                ${this.adminAppUrl ? `<p><a href="${escapeHtml(this.adminAppUrl)}">Review registration requests</a></p>` : ""}
            `
        }, "SUPER_ADMIN_REGISTRATION_NOTIFICATION");
    }

    async sendRegistrationApproved(payload: ApprovalEmail): Promise<void> {
        const tenantName = payload.tenantName || "your organization";
        const loginLine = this.customerLoginUrl ? `You can sign in here: ${this.customerLoginUrl}` : "";

        await this.send({
            to: payload.customerEmail,
            subject: "Your SentryX registration was approved",
            text: [
                greeting(payload.customerName),
                "",
                `Your registration for ${tenantName} was approved.`,
                loginLine
            ].filter(Boolean).join("\n"),
            html: `
                <p>${escapeHtml(greeting(payload.customerName))}</p>
                <p>Your registration for <strong>${escapeHtml(tenantName)}</strong> was approved.</p>
                ${this.customerLoginUrl ? `<p><a href="${escapeHtml(this.customerLoginUrl)}">Sign in to SentryX</a></p>` : ""}
            `
        }, "REGISTRATION_APPROVED_EMAIL");
    }

    async sendRegistrationRejected(payload: RejectionEmail): Promise<void> {
        const tenantName = payload.tenantName || "your organization";
        const reason = payload.rejectionReason?.trim();
        const supportLine = this.supportEmail ? `If you have questions, contact ${this.supportEmail}.` : "";

        await this.send({
            to: payload.customerEmail,
            subject: "Your SentryX registration was not approved",
            text: [
                greeting(payload.customerName),
                "",
                `Your registration request for ${tenantName} was not approved.`,
                reason ? `Reason: ${reason}` : "",
                supportLine
            ].filter(Boolean).join("\n"),
            html: `
                <p>${escapeHtml(greeting(payload.customerName))}</p>
                <p>Your registration request for <strong>${escapeHtml(tenantName)}</strong> was not approved.</p>
                ${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ""}
                ${supportLine ? `<p>${escapeHtml(supportLine)}</p>` : ""}
            `
        }, "REGISTRATION_REJECTED_EMAIL");
    }
}

export const EmailService = new GmailEmailService();

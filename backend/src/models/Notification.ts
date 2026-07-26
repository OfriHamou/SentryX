import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index, OneToMany } from "typeorm";
import { Tenant } from "./Tenant";
import { Robot } from "./Robot";
import { Event } from "./Event";
import { NotificationRecipient } from "./NotificationRecipient";
import { Alert } from "./Alert";

@Entity("notifications")
@Index("idx_notifications_unread", ["tenant", "isRead"])
@Index("idx_notifications_alert", ["alert"])
@Index("uq_notifications_alert_id", ["alert"], { unique: true, where: "alert_id IS NOT NULL" })
export class Notification {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Tenant, (tenant) => tenant.notifications, { onDelete: "CASCADE" })
    @JoinColumn({ name: "tenant_id" })
    tenant: Tenant;

    @ManyToOne(() => Robot, (robot) => robot.notifications, { onDelete: "CASCADE" })
    @JoinColumn({ name: "robot_id" })
    robot: Robot;

    @ManyToOne(() => Event, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "event_id" })
    event: Event | null;

    @ManyToOne(() => Alert, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "alert_id" })
    alert: Alert | null;

    @Column({ type: "varchar", length: 255, nullable: true })
    title: string | null;

    @Column({ type: "text", nullable: true })
    message: string | null;

    @Column({ type: "varchar", length: 50, default: "info" })
    severity: string;

    @Column({ name: "is_read", type: "boolean", default: false })
    isRead: boolean;

    @Column({ name: "target_apps", type: "text", array: true, default: "{}" })
    targetApps: string[];

    @Column({ type: "jsonb", nullable: true })
    metadata: Record<string, unknown> | null;

    @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
    createdAt: Date;

    @OneToMany(() => NotificationRecipient, (recipient) => recipient.notification)
    recipients: NotificationRecipient[];
}

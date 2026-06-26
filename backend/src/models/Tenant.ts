import crypto from "crypto";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { User } from "./User";
import { Robot } from "./Robot";
import { Notification } from "./Notification";
import { Event } from "./Event";
import { TenantLicense } from "./TenantLicense";

@Entity("tenants")
export class Tenant {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 255 })
    name: string;

    @Column({ name: "invite_code", type: "varchar", length: 100, unique: true, nullable: true })
    inviteCode: string | null;

    @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
    createdAt: Date;

    @OneToMany(() => User, (user) => user.tenant)
    users: User[];

    @OneToMany(() => Robot, (robot) => robot.tenant)
    robots: Robot[];

    @OneToMany(() => Notification, (notification) => notification.tenant)
    notifications: Notification[];

    @OneToMany(() => Event, (event) => event.tenant)
    events: Event[];

    @OneToMany(() => TenantLicense, (tenantLicense) => tenantLicense.tenant)
    tenantLicenses: TenantLicense[];

    /**
     * Generate a friendly public invite code for the tenant.
     * This is separate from the internal tenant UUID primary key.
     * Format: ORG-{INITIALS}-{SUFFIX}
     * Example: ORG-ACME-A1B2C3
     */
    generateInviteCode(): string {
        const initials = this.name
            .split(" ")
            .map((word) => word[0])
            .join("")
            .toUpperCase()
            .slice(0, 3)
            .padEnd(3, "X");

        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();

        return `ORG-${initials}-${suffix}`;
    }
}

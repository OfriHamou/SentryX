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
}

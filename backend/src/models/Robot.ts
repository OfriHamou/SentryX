import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn, Index, OneToMany, OneToOne } from "typeorm";
import { Tenant } from "./Tenant";
import { Notification } from "./Notification";
import { Event } from "./Event";
import { RobotConfig } from "./RobotConfig";

@Entity("robots")
@Index("idx_robots_tenant", ["tenant"])
@Index("idx_robots_status", ["status"])
export class Robot {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Tenant, (tenant) => tenant.robots, { onDelete: "CASCADE" })
    @JoinColumn({ name: "tenant_id" })
    tenant: Tenant;

    @Column({ type: "varchar", length: 100 })
    name: string;

    @Column({ name: "robot_url", type: "varchar", length: 1024, nullable: true })
    robotUrl: string;

    @Column({ type: "varchar", length: 50, default: "Offline" })
    status: string;

    @Column({ name: "last_connection", type: "timestamp with time zone", nullable: true })
    lastConnection: Date;

    @UpdateDateColumn({ name: "updated_at", type: "timestamp with time zone" })
    updatedAt: Date;

    @OneToOne(() => RobotConfig, (config) => config.robot)
    config: RobotConfig;

    @OneToMany(() => Notification, (notification) => notification.robot)
    notifications: Notification[];

    @OneToMany(() => Event, (event) => event.robot)
    events: Event[];
}

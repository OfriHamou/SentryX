import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { Tenant } from "./Tenant";
import { Robot } from "./Robot";

@Entity("notifications")
@Index("idx_notifications_unread", ["tenant", "isRead"])
export class Notification {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Tenant, (tenant) => tenant.notifications, { onDelete: "CASCADE" })
    @JoinColumn({ name: "tenant_id" })
    tenant: Tenant;

    @ManyToOne(() => Robot, (robot) => robot.notifications, { onDelete: "CASCADE" })
    @JoinColumn({ name: "robot_id" })
    robot: Robot;

    @Column({ type: "varchar", length: 255, nullable: true })
    title: string;

    @Column({ type: "text", nullable: true })
    message: string;

    @Column({ type: "varchar", length: 50, default: "info" })
    severity: string;

    @Column({ name: "is_read", type: "boolean", default: false })
    isRead: boolean;

    @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
    createdAt: Date;
}


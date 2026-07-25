import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { Event } from "./Event";
import { SecurityShift } from "./SecurityShift";
import { Tenant } from "./Tenant";
import { User } from "./User";

export enum AlertStatus {
    OPEN = "OPEN",
    IN_PROGRESS = "IN_PROGRESS",
    RESOLVED = "RESOLVED",
}

@Entity("alerts")
@Index("uq_alerts_event_id", ["event"], { unique: true })
@Index("idx_alerts_tenant_created_at", ["tenant", "createdAt"])
@Index("idx_alerts_tenant_status", ["tenant", "status"])
@Index("idx_alerts_assigned_user_status", ["assignedUser", "status"])
export class Alert {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Tenant, { onDelete: "CASCADE" })
    @JoinColumn({ name: "tenant_id" })
    tenant: Tenant;

    @OneToOne(() => Event, { onDelete: "CASCADE" })
    @JoinColumn({ name: "event_id" })
    event: Event;

    @Column({ type: "varchar", length: 20, default: AlertStatus.OPEN })
    status: AlertStatus;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "assigned_user_id" })
    assignedUser: User | null;

    @ManyToOne(() => SecurityShift, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "assigned_shift_id" })
    assignedShift: SecurityShift | null;

    @Column({ name: "started_at", type: "timestamp with time zone", nullable: true })
    startedAt: Date | null;

    @Column({ name: "resolved_at", type: "timestamp with time zone", nullable: true })
    resolvedAt: Date | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "resolved_by" })
    resolvedBy: User | null;

    @Column({ name: "resolution_notes", type: "text", nullable: true })
    resolutionNotes: string | null;

    @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at", type: "timestamp with time zone" })
    updatedAt: Date;
}

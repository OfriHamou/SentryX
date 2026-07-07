import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Tenant } from "./Tenant";
import { User } from "./User";

export enum SecurityShiftStatus {
    SCHEDULED = "SCHEDULED",
    ACTIVE = "ACTIVE",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
}

@Entity("security_shifts")
@Index("idx_security_shifts_tenant_dates", ["tenant", "startAt", "endAt"])
@Index("idx_security_shifts_tenant_status", ["tenant", "status"])
export class SecurityShift {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Tenant, { onDelete: "CASCADE" })
    @JoinColumn({ name: "tenant_id" })
    tenant: Tenant;

    @ManyToOne(() => User, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "assigned_user_id" })
    assignedUser: User;

    @Column({ type: "varchar", length: 255 })
    name: string;

    @Column({ name: "start_at", type: "timestamp with time zone" })
    startAt: Date;

    @Column({ name: "end_at", type: "timestamp with time zone" })
    endAt: Date;

    @Column({ type: "varchar", length: 30, default: SecurityShiftStatus.SCHEDULED })
    status: SecurityShiftStatus;

    @Column({ type: "text", nullable: true })
    notes: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "created_by" })
    createdBy: User | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "updated_by" })
    updatedBy: User | null;

    @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at", type: "timestamp with time zone" })
    updatedAt: Date;
}

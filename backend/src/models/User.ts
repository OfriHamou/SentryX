import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, OneToMany } from "typeorm";
import { Tenant } from "./Tenant";
import { Role } from "./Role";
import { RefreshTokenSession } from "./RefreshTokenSession";

export enum UserStatus {
    PENDING_APPROVAL = "PENDING_APPROVAL",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}

@Entity("users")
@Index("idx_users_tenant", ["tenant"])
@Index("idx_users_email", ["email"])
@Index("idx_users_status", ["status"])
export class User {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Tenant, (tenant) => tenant.users, { onDelete: "CASCADE" })
    @JoinColumn({ name: "tenant_id" })
    tenant: Tenant;

    @ManyToOne(() => Role, (role) => role.users)
    @JoinColumn({ name: "role_id" })
    role: Role;

    @Column({ type: "varchar", length: 255, unique: true })
    email: string;

    @Column({ name: "password_hash", type: "text" })
    passwordHash: string;

    @Column({ name: "full_name", type: "varchar", length: 255, nullable: true })
    fullName: string;

    @Column({ type: "varchar", length: 20, nullable: true })
    phone: string;

    @Column({ name: "job_title", type: "varchar", length: 255, nullable: true })
    jobTitle: string;

    @Column({ type: "varchar", length: 30, default: UserStatus.APPROVED })
    status: UserStatus;

    @Column({ name: "approved_at", type: "timestamp with time zone", nullable: true })
    approvedAt: Date | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "approved_by" })
    approvedBy: User | null;

    @Column({ name: "rejected_at", type: "timestamp with time zone", nullable: true })
    rejectedAt: Date | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "rejected_by" })
    rejectedBy: User | null;

    @Column({ name: "rejection_reason", type: "text", nullable: true })
    rejectionReason: string | null;

    @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at", type: "timestamp with time zone" })
    updatedAt: Date;

    @OneToMany(() => RefreshTokenSession, (session) => session.user)
    refreshTokenSessions: RefreshTokenSession[];
}


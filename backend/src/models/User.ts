import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { Tenant } from "./Tenant";
import { Role } from "./Role";

@Entity("users")
@Index("idx_users_tenant", ["tenant"])
@Index("idx_users_email", ["email"])
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

    @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
    createdAt: Date;
}


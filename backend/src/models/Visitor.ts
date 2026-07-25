import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Tenant } from "./Tenant";
import { User } from "./User";

export enum VisitorStatus {
    SCHEDULED = "SCHEDULED",
    ACTIVE = "ACTIVE",
    COMPLETED = "COMPLETED",
    EXPIRED = "EXPIRED",
    CANCELLED = "CANCELLED",
}

@Entity("visitors")
@Index("idx_visitors_tenant_dates", ["tenant", "startAt", "endAt"])
@Index("idx_visitors_tenant_status", ["tenant", "status"])
@Index("idx_visitors_host_user", ["host"])
export class Visitor {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Tenant, { onDelete: "CASCADE" })
    @JoinColumn({ name: "tenant_id" })
    tenant: Tenant;

    @ManyToOne(() => User, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "host_user_id" })
    host: User;

    @Column({ type: "varchar", length: 255 })
    name: string;

    @Column({ type: "varchar", length: 30 })
    phone: string;

    @Column({ type: "varchar", length: 255, nullable: true })
    email: string | null;

    @Column({ type: "text" })
    purpose: string;

    @Column({ name: "start_at", type: "timestamp with time zone" })
    startAt: Date;

    @Column({ name: "end_at", type: "timestamp with time zone" })
    endAt: Date;

    @Column({ type: "varchar", length: 30, default: VisitorStatus.SCHEDULED })
    status: VisitorStatus;

    @Column({ name: "face_image", type: "varchar", length: 512 })
    faceImage: string;

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

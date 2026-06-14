import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Tenant } from "./Tenant";

@Entity("authorized_faces")
export class AuthorizedFace {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Tenant, { onDelete: "CASCADE" })
    @JoinColumn({ name: "tenant_id" })
    tenant: Tenant;

    @Column({ type: "varchar", length: 255 })
    name: string;

    @Column({ type: "varchar", length: 100, nullable: true })
    role: string;

    @Column({ type: "jsonb", default: () => "'[]'" })
    images: string[];

    @CreateDateColumn({ name: "added_at", type: "timestamp with time zone" })
    addedAt: Date;
}

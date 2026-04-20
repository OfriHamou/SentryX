import { Entity, PrimaryColumn, Column, CreateDateColumn } from "typeorm";

@Entity("licenses")
export class License {
    @PrimaryColumn({ type: "varchar", length: 50 })
    code: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
    createdAt: Date;
}

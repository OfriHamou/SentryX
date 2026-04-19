import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Tenant } from "./Tenant";
import { Robot } from "./Robot";

@Entity("events")
export class Event {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Robot, (robot) => robot.events)
    @JoinColumn({ name: "robot_id" })
    robot: Robot;

    @ManyToOne(() => Tenant, (tenant) => tenant.events)
    @JoinColumn({ name: "tenant_id" })
    tenant: Tenant;

    @Column({ name: "event_type", type: "varchar", length: 50, nullable: true })
    eventType: string;

    @Column({ name: "image_path", type: "text", nullable: true })
    imagePath: string;

    @Column({ name: "ai_metadata", type: "jsonb", nullable: true })
    aiMetadata: any;

    @Column({ type: "varchar", length: 20, default: "pending" })
    status: string;

    @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
    createdAt: Date;
}


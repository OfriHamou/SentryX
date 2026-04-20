import { Entity, Column, UpdateDateColumn, OneToOne, JoinColumn, PrimaryColumn } from "typeorm";
import { Robot } from "./Robot";

@Entity("robot_config")
export class RobotConfig {
    @PrimaryColumn({ name: "robot_id", type: "uuid" })
    robotId: string;

    @OneToOne(() => Robot, (robot) => robot.config, { onDelete: "CASCADE" })
    @JoinColumn({ name: "robot_id" })
    robot: Robot;

    @Column({ name: "config_data", type: "jsonb" })
    configData: any;

    @UpdateDateColumn({ name: "updated_at", type: "timestamp with time zone" })
    updatedAt: Date;
}


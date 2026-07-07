import { Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Column, Index, Unique } from "typeorm";
import { Notification } from "./Notification";
import { User } from "./User";

@Entity("notification_recipients")
@Unique("uq_notification_recipients_notification_user", ["notification", "user"])
@Index("idx_notification_recipients_user_read_at", ["user", "readAt"])
@Index("idx_notification_recipients_notification", ["notification"])
export class NotificationRecipient {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Notification, (notification) => notification.recipients, { onDelete: "CASCADE" })
    @JoinColumn({ name: "notification_id" })
    notification: Notification;

    @ManyToOne(() => User, (user) => user.notificationRecipients, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user: User;

    @Column({ name: "read_at", type: "timestamp with time zone", nullable: true })
    readAt: Date | null;

    @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at", type: "timestamp with time zone" })
    updatedAt: Date;
}


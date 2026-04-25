import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm";
import { User } from "./User";

@Entity("refresh_token_sessions")
@Index("idx_refresh_sessions_user_active", ["user", "isActive"])
@Index("idx_refresh_sessions_expires_at", ["expiresAt"])
export class RefreshTokenSession {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User, (user) => user.refreshTokenSessions, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user: User;

    @Column({ name: "token_hash", type: "text" })
    tokenHash: string;

    @Column({ name: "is_active", type: "boolean", default: true })
    isActive: boolean;

    @Column({ name: "expires_at", type: "timestamp with time zone" })
    expiresAt: Date;

    @CreateDateColumn({ name: "created_at", type: "timestamp with time zone" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at", type: "timestamp with time zone" })
    updatedAt: Date;
}

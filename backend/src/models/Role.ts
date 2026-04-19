import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { User } from "./User";

@Entity("roles")
export class Role {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: "role_name", type: "varchar", length: 50, unique: true })
    roleName: string;

    @Column({ name: "allowed_pages", type: "jsonb" })
    allowedPages: any;

    @OneToMany(() => User, (user) => user.role)
    users: User[];
}


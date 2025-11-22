import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { AdminSession } from './AdminSession';

@Entity('admin_users')
@Index(['username'], { unique: true })
export class AdminUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @OneToMany(() => AdminSession, (session) => session.adminUser)
  sessions: AdminSession[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


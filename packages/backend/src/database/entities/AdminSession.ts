import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AdminUser } from './AdminUser';

@Entity('admin_sessions')
@Index(['sessionToken'], { unique: true })
@Index(['adminUserId'])
export class AdminSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  adminUserId: number;

  @ManyToOne(() => AdminUser)
  @JoinColumn({ name: 'adminUserId' })
  adminUser: AdminUser;

  @Column({ unique: true })
  sessionToken: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}


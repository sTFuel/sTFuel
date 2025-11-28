import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Address } from './Address';
import { Server } from './Server';

@Entity('managed_nodes')
@Index(['addressId'], { unique: true })
@Index(['serverId'])
@Index(['isRunning'])
export class ManagedNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  addressId: number;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'addressId' })
  address: Address;

  @Column()
  serverId: number;

  @ManyToOne(() => Server)
  @JoinColumn({ name: 'serverId' })
  server: Server;

  @Column()
  nodeId: string;

  @Column({ type: 'jsonb', nullable: true })
  keystore: object | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ default: false })
  isRunning: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


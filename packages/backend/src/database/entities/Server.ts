import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { ManagedNode } from './ManagedNode';

@Entity('servers')
@Index(['ipAddress'], { unique: true })
export class Server {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  ipAddress: string;

  @Column({ default: false })
  isHealthy: boolean;

  @Column({ type: 'int' })
  maxEdgeNodes: number;

  @OneToMany(() => ManagedNode, (managedNode) => managedNode.server)
  managedNodes: ManagedNode[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Address } from './Address';

export enum NodeType {
  TENK = 'Tenk',
  FIFTYK = 'Fiftyk',
  HUNDREDK = 'Hundredk',
  TWOHUNDREDK = 'TwoHundredk',
  FIVEHUNDREDK = 'FiveHundredk'
}

@Entity('edge_nodes')
@Index(['addressId'])
@Index(['isActive'])
@Index(['isFaulty'])
export class EdgeNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  addressId: number;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'addressId' })
  address: Address;

  @Column({ type: 'bigint' })
  registrationBlock: string;

  @Column({ type: 'int' })
  registrationTimestamp: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'bigint', nullable: true })
  deactivationBlock: string;

  @Column({ type: 'int', nullable: true })
  deactivationTimestamp: number;

  @Column({ default: false })
  isFaulty: boolean;

  @Column({ type: 'bigint', nullable: true })
  faultyBlock: string;

  @Column({ type: 'int', nullable: true })
  faultyTimestamp: number;

  @Column({ type: 'bigint', nullable: true })
  recoveryBlock: string;

  @Column({ type: 'int', nullable: true })
  recoveryTimestamp: number;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '0' })
  totalStaked: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '0' })
  totalUnstaked: string;

  @Column({ type: 'bigint', nullable: true })
  unstakeBlock: string | null;

  @Column({ type: 'enum', enum: NodeType, nullable: true })
  nodeType: NodeType;

  @Column({ default: true })
  isLive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

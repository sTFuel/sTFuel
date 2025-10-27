import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Address } from './Address';

export enum RedemptionStatus {
  PENDING = 'pending',
  CREDITED = 'credited'
}

@Entity('redemption_queue')
@Index(['userAddressId'])
@Index(['status'])
@Index(['unlockBlockNumber'])
export class RedemptionQueue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userAddressId: number;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'userAddressId' })
  userAddress: Address;

  @Column({ type: 'bigint' })
  requestBlock: string;

  @Column({ type: 'timestamp' })
  requestTimestamp: Date;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  stfuelAmountBurned: string;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  tfuelAmountExpected: string;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  keepersTipFee: string;

  @Column({ type: 'bigint' })
  unlockBlockNumber: string;

  @Column({ type: 'timestamp', nullable: true })
  unlockTimestamp: Date;

  @Column({ type: 'bigint' })
  queueIndex: string;

  @Column({ 
    type: 'enum', 
    enum: RedemptionStatus,
    default: RedemptionStatus.PENDING
  })
  status: RedemptionStatus;

  @Column({ type: 'bigint', nullable: true })
  creditedBlock: string;

  @Column({ type: 'timestamp', nullable: true })
  creditedTimestamp: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('hourly_snapshots')
@Index(['snapshotTimestamp'])
@Index(['blockNumber'])
export class HourlySnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint' })
  blockNumber: string;

  @Column({ type: 'int' })
  snapshotTimestamp: number;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  tfuelBackingAmount: string;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  tfuelStakedAmount: string;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  stfuelTotalSupply: string;

  @Column()
  currentHoldersCount: number;

  @Column()
  historicalHoldersCount: number;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  totalReferralRewards: string;

  @Column()
  edgeNodesCount: number;

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  totalKeeperTipsPaid: string;

  @CreateDateColumn()
  createdAt: Date;
}

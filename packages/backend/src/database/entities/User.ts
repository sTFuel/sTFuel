import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Address } from './Address';

@Entity('users')
@Index(['addressId'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  addressId: number;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'addressId' })
  address: Address;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '0' })
  stfuelBalance: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '0' })
  totalDeposited: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '0' })
  totalWithdrawn: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '0' })
  totalMinted: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '0' })
  totalBurned: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '0' })
  totalKeeperFeesEarned: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '0' })
  totalReferralFeesEarned: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '0' })
  totalEnteringFeesPaid: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '0' })
  totalExitFeesPaid: string;

  @Column({ type: 'numeric', precision: 78, scale: 0, default: '0' })
  creditsAvailable: string;

  @Column({ type: 'bigint', nullable: true })
  firstActivityBlock: string;

  @Column({ type: 'int', nullable: true })
  firstActivityTimestamp: number;

  @Column({ type: 'bigint', nullable: true })
  lastActivityBlock: string;

  @Column({ type: 'int', nullable: true })
  lastActivityTimestamp: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

@Entity('stfuel_events')
@Index(['blockNumber', 'transactionIndex', 'logIndex'])
@Index(['eventName'])
@Index(['address'])
@Unique(['blockNumber', 'transactionHash', 'logIndex'])
export class StfuelEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  eventName: string;

  @Column({ type: 'bigint' })
  blockNumber: string;

  @Column()
  transactionHash: string;

  @Column()
  transactionIndex: number;

  @Column()
  logIndex: number;

  @Column({ type: 'int' })
  timestamp: number;

  @Column()
  address: string;

  @Column({ type: 'jsonb', nullable: true })
  args: any;

  @Column({ type: 'text', nullable: true })
  data: string;

  @Column({ type: 'text', array: true, nullable: true })
  topics: string[];

  @CreateDateColumn()
  createdAt: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('addresses')
@Index(['address'], { unique: true })
export class Address {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 42 })
  address: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

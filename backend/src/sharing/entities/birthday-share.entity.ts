import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum ShareStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
}

// Owner teilt alle seine Geburtstage mit dem Recipient. Einseitig: der
// Recipient sieht und bearbeitet die Einträge des Owners, nicht umgekehrt.
// Ablehnen, Zurückziehen und Beenden löschen die Zeile.
@Entity('birthday_shares')
@Unique(['ownerId', 'recipientId'])
@Check(`"ownerId" <> "recipientId"`)
export class BirthdayShare {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @Column()
  ownerId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'recipientId' })
  recipient!: User;

  @Column()
  recipientId!: number;

  @Column({ type: 'varchar', length: 20, default: ShareStatus.PENDING })
  status!: ShareStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;
}

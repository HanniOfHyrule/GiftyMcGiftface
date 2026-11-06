import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('todoist_connections')
export class TodoistConnection {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: number;

  // Tokens werden verschlüsselt gespeichert (siehe token-crypto.ts)
  @Column({ type: 'text' })
  accessToken!: string;

  @Column({ type: 'text', nullable: true })
  refreshToken!: string | null;

  // null = Token läuft nicht ab (ältere Todoist-Apps)
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  projectId!: string | null;

  @Column({ type: 'int', default: 7 })
  presentLeadDays!: number;

  @Column({ type: 'int', default: 5 })
  cardLeadDays!: number;

  @Column({ type: 'int', default: 0 })
  whatsappLeadDays!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

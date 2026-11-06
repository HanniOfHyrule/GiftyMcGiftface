import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { randomUUID } from 'crypto';

export enum TodoType {
  WHATSAPP = 'WHATSAPP',
  NEEDCARD = 'NEEDCARD',
  NEEDPRESENT = 'NEEDPRESENT',
}

export interface SharedBy {
  name: string;
  lastName: string;
}

@Entity('birthdays')
export class Birthday {
  constructor(data?: Partial<Birthday>) {
    if (data) {
      this.id = data.id || 0;
      this.entryId = data.entryId || randomUUID();
      this.name = data.name || '';
      this.lastName = data.lastName || '';
      this.dateOfBirth = data.dateOfBirth || null;
      this.Todo = data.Todo || TodoType.NEEDPRESENT;
      this.sharedBy = data.sharedBy ?? null;
    }
  }

  // Keine Spalte: gesetzt, wenn der Eintrag einem anderen User gehört, der
  // seine Geburtstage mit dem anfragenden User teilt.
  sharedBy?: SharedBy | null;

  @ManyToOne(() => User, { eager: false, nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid', unique: true, default: () => 'gen_random_uuid()' })
  entryId!: string;

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  lastName!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  dateOfBirth!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: TodoType.NEEDPRESENT,
  })
  Todo!: TodoType;

  get fullName(): string {
    return `${this.name} ${this.lastName}`.trim();
  }

  get hasValidBirthdate(): boolean {
    return !!this.dateOfBirth && this.dateOfBirth.length > 0;
  }

  static create(data: Partial<Birthday>): Birthday {
    const b = new Birthday();
    Object.assign(b, data);
    return b;
  }

  static createMany(dataArray: Partial<Birthday>[]): Birthday[] {
    return dataArray.map((data) => new Birthday(data));
  }
}

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Birthday } from '../../birthday/entities/birthday.entity';

// Merkt sich, für welchen Geburtstag in welchem Jahr schon eine Aufgabe
// angelegt wurde - so entstehen keine Duplikate, und in Todoist gelöschte
// Aufgaben werden nicht erneut angelegt. Pro User, weil ein geteilter
// Geburtstag bei Besitzer und Empfänger je eine eigene Aufgabe bekommt.
@Entity('todoist_tasks')
@Unique(['userId', 'birthdayId', 'year'])
export class TodoistTask {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Birthday, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'birthdayId' })
  birthday!: Birthday;

  @Column()
  birthdayId!: number;

  @Column({ type: 'int' })
  userId!: number;

  // Jahr des Geburtstags, für den die Aufgabe angelegt wurde
  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'varchar', length: 64 })
  todoistTaskId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

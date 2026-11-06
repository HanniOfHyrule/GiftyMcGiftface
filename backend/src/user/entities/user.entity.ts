import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  constructor(data?: Partial<User>) {
    if (data) {
      this.id = data.id || 0;
      this.email = data.email || '';
      this.passwordHash = data.passwordHash || '';
      this.name = data.name || '';
      this.lastName = data.lastName || '';
    }
  }
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  lastName!: string;

  @Column({ type: 'varchar', nullable: true })
  refreshTokenHash!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  calendarToken!: string | null;
}

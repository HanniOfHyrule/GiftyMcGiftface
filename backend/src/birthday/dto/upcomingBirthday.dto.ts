import { Birthday } from '../entities/birthday.entity';

export class UpcomingBirthdayDto extends Birthday {
  daysUntilBirthday: number;
  birthdayThisYear: string;
  age: number | null;

  constructor(
    birthday: Birthday,
    daysUntil: number,
    birthdayThisYear: Date,
    age: number | null,
  ) {
    super(birthday);
    this.daysUntilBirthday = daysUntil;
    this.birthdayThisYear = birthdayThisYear.toISOString().split('T')[0];
    this.age = age;
  }

  static fromBirthday(
    birthday: Birthday,
    daysUntil: number,
    birthdayThisYear: Date,
    age: number | null,
  ): UpcomingBirthdayDto {
    return new UpcomingBirthdayDto(birthday, daysUntil, birthdayThisYear, age);
  }

  get isToday(): boolean {
    return this.daysUntilBirthday === 0;
  }

  get isTomorrow(): boolean {
    return this.daysUntilBirthday === 1;
  }

  get urgencyLevel(): 'high' | 'medium' | 'low' {
    if (this.daysUntilBirthday <= 1) return 'high';
    if (this.daysUntilBirthday <= 7) return 'medium';
    return 'low';
  }
}

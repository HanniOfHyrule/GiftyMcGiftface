import { UpcomingBirthdayDto } from './upcomingBirthday.dto';

export interface MonthStatistic {
  month: number;
  monthName: string;
  count: number;
}

export class StatisticsDto {
  total!: number;
  upcomingCount!: number;
  byMonth!: MonthStatistic[];
  upcoming!: UpcomingBirthdayDto[];

  constructor(data?: Partial<StatisticsDto>) {
    if (data) {
      this.total = data.total || 0;
      this.upcomingCount = data.upcomingCount || 0;
      this.byMonth = data.byMonth || [];
      this.upcoming = data.upcoming || [];
    }
  }

  static create(data: Partial<StatisticsDto>): StatisticsDto {
    return new StatisticsDto(data);
  }

  get hasUpcomingBirthdays(): boolean {
    return this.upcomingCount > 0;
  }

  get averageBirthdaysPerMonth(): number {
    return this.total > 0 ? Math.round((this.total / 12) * 100) / 100 : 0;
  }

  getBusiestMonth(): MonthStatistic | null {
    if (this.byMonth.length === 0) return null;
    return this.byMonth.reduce((max, current) =>
      current.count > max.count ? current : max,
    );
  }
}

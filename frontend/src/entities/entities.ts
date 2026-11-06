export interface Birthday {
  id: number;
  name: string;
  lastName: string;
  dateOfBirth: string | null;
  Todo: 'WHATSAPP' | 'NEEDCARD' | 'NEEDPRESENT';
  /** Gesetzt, wenn der Eintrag einem anderen User gehört, der mit dir teilt */
  sharedBy?: SharedBy | null;
}

export interface SharedBy {
  name: string;
  lastName: string;
}

/** Freigabe aus eigener Sicht: `user` ist immer die Gegenseite */
export interface Share {
  id: number;
  status: 'PENDING' | 'ACCEPTED';
  createdAt: string;
  user: { name: string; lastName: string; email: string };
}

export interface SharesOverview {
  outgoing: Share[];
  incoming: Share[];
}

export interface UpcomingBirthday extends Birthday {
  daysUntilBirthday: number;
  birthdayThisYear: string;
  age: number | null;
}

export interface Statistics {
  total: number;
  upcomingCount: number;
  byMonth: MonthStatistic[];
  upcoming: UpcomingBirthday[];
}

export interface MonthStatistic {
  month: number;
  monthName: string;
  count: number;
}

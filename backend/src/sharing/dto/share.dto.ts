import { ShareStatus } from '../entities/birthday-share.entity';

// Eine Freigabe aus Sicht des anfragenden Users: `user` ist immer die
// Gegenseite (bei ausgehenden der Empfänger, bei eingehenden der Besitzer).
export interface ShareDto {
  id: number;
  status: ShareStatus;
  createdAt: Date;
  user: { name: string; lastName: string; email: string };
}

export interface SharesOverviewDto {
  outgoing: ShareDto[];
  incoming: ShareDto[];
}

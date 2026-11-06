import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { BirthdayShare, ShareStatus } from './entities/birthday-share.entity';
import { ShareDto, SharesOverviewDto } from './dto/share.dto';
import { birthdaySharesTotal } from '../metrics/metrics';

@Injectable()
export class SharingService {
  constructor(
    @InjectRepository(BirthdayShare)
    private readonly shares: Repository<BirthdayShare>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async list(userId: number): Promise<SharesOverviewDto> {
    const [outgoing, incoming] = await Promise.all([
      this.shares.find({
        where: { ownerId: userId },
        relations: { recipient: true },
        order: { createdAt: 'ASC' },
      }),
      this.shares.find({
        where: { recipientId: userId },
        relations: { owner: true },
        order: { createdAt: 'ASC' },
      }),
    ]);
    return {
      outgoing: outgoing.map((s) => toDto(s, s.recipient)),
      incoming: incoming.map((s) => toDto(s, s.owner)),
    };
  }

  async invite(ownerId: number, email: string): Promise<ShareDto> {
    // E-Mails werden bei der Registrierung nicht normalisiert
    const recipient = await this.users.findOne({
      where: {
        email: Raw((alias) => `LOWER(${alias}) = LOWER(:email)`, {
          email: email.trim(),
        }),
      },
    });
    if (!recipient) {
      throw new NotFoundException('Kein Nutzer mit dieser E-Mail gefunden');
    }
    if (recipient.id === ownerId) {
      throw new BadRequestException('Du kannst nicht mit dir selbst teilen');
    }
    const existing = await this.shares.findOne({
      where: { ownerId, recipientId: recipient.id },
    });
    if (existing) {
      throw new ConflictException('Mit diesem Nutzer teilst du bereits');
    }

    const share = await this.shares.save({
      ownerId,
      recipientId: recipient.id,
      status: ShareStatus.PENDING,
      acceptedAt: null,
    });
    birthdaySharesTotal.inc({ action: 'requested' });
    return toDto(share, recipient);
  }

  async accept(userId: number, shareId: number): Promise<ShareDto> {
    const share = await this.shares.findOne({
      where: { id: shareId, recipientId: userId, status: ShareStatus.PENDING },
      relations: { owner: true },
    });
    if (!share) throw new NotFoundException('Anfrage nicht gefunden');

    share.status = ShareStatus.ACCEPTED;
    share.acceptedAt = new Date();
    await this.shares.update(share.id, {
      status: share.status,
      acceptedAt: share.acceptedAt,
    });
    birthdaySharesTotal.inc({ action: 'accepted' });
    return toDto(share, share.owner);
  }

  // Besitzer zieht zurück bzw. beendet, Empfänger lehnt ab bzw. beendet.
  async remove(userId: number, shareId: number): Promise<void> {
    const share = await this.shares.findOne({ where: { id: shareId } });
    if (!share || (share.ownerId !== userId && share.recipientId !== userId)) {
      throw new NotFoundException('Freigabe nicht gefunden');
    }
    await this.shares.delete({ id: share.id });

    const action =
      share.ownerId === userId
        ? 'revoked'
        : share.status === ShareStatus.PENDING
          ? 'declined'
          : 'left';
    birthdaySharesTotal.inc({ action });
  }

  // Alle User, deren Geburtstage userId sieht: er selbst plus alle, die eine
  // bestätigte Freigabe an ihn haben.
  async ownerIdsVisibleTo(userId: number): Promise<number[]> {
    const accepted = await this.shares.find({
      where: { recipientId: userId, status: ShareStatus.ACCEPTED },
      select: { ownerId: true },
    });
    return [userId, ...accepted.map((s) => s.ownerId)];
  }
}

function toDto(share: BirthdayShare, other: User): ShareDto {
  return {
    id: share.id,
    status: share.status,
    createdAt: share.createdAt,
    user: { name: other.name, lastName: other.lastName, email: other.email },
  };
}

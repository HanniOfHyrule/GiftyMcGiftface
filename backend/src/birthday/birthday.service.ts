import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Birthday } from './entities/birthday.entity';
import { User } from '../user/entities/user.entity';
import { StatisticsDto, MonthStatistic } from './dto/statistics.dto';
import { CreateBirthdayDto } from './dto/createBirthday.dto';
import { UpdateBirthdayDto } from './dto/updateBirthday.dto';
import { UpcomingBirthdayDto } from './dto/upcomingBirthday.dto';
import { SharingService } from '../sharing/sharing.service';
import {
  birthdaysCreatedTotal,
  birthdaysDeletedTotal,
  birthdaysUpdatedTotal,
} from '../metrics/metrics';

interface DuplicateGroup {
  name: string;
  lastName: string;
  entries: Birthday[];
  count: number;
}

@Injectable()
export class BirthdayService {
  private readonly logger = new Logger(BirthdayService.name);

  constructor(
    @InjectRepository(Birthday)
    private birthdayRepository: Repository<Birthday>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private sharingService: SharingService,
  ) {}

  async getOrCreateCalendarToken(userId: number): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.calendarToken) return user.calendarToken;
    return this.regenerateCalendarToken(userId);
  }

  async regenerateCalendarToken(userId: number): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.userRepository.update(userId, { calendarToken: token });
    return token;
  }

  async findUserIdByCalendarToken(token: string): Promise<number | null> {
    const user = await this.userRepository.findOne({
      where: { calendarToken: token },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  async findDuplicates(userId: number): Promise<DuplicateGroup[]> {
    try {
      const allBirthdays = await this.findAll(userId);
      const duplicateMap = new Map<string, Birthday[]>();

      allBirthdays.forEach((birthday) => {
        const key = `${birthday.name.toLowerCase()}_${birthday.lastName.toLowerCase()}`;
        if (!duplicateMap.has(key)) {
          duplicateMap.set(key, []);
        }
        duplicateMap.get(key)!.push(birthday);
      });

      const duplicateGroups: DuplicateGroup[] = [];
      duplicateMap.forEach((entries) => {
        if (entries.length > 1) {
          duplicateGroups.push({
            name: entries[0].name,
            lastName: entries[0].lastName,
            entries: entries,
            count: entries.length,
          });
        }
      });

      return duplicateGroups;
    } catch (error) {
      this.logger.error(
        'Error finding duplicates',
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Failed to find duplicates');
    }
  }

  // Eigene Geburtstage plus die aller User, die ihre mit userId teilen.
  async findAll(userId: number): Promise<Birthday[]> {
    try {
      const ownerIds = await this.sharingService.ownerIdsVisibleTo(userId);
      const birthdays = await this.birthdayRepository.find({
        where: { user: { id: In(ownerIds) } },
        relations: { user: true },
        order: { name: 'ASC' },
      });
      const birthdayInstances = birthdays.map(
        (b) =>
          new Birthday({
            ...b,
            sharedBy:
              b.user && b.user.id !== userId
                ? { name: b.user.name, lastName: b.user.lastName }
                : null,
          }),
      );
      return birthdayInstances;
    } catch (error) {
      this.logger.error(
        'Error finding birthdays',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async create(
    createBirthdayData: Partial<CreateBirthdayDto>,
    userId: number,
  ): Promise<Birthday> {
    const createDto = CreateBirthdayDto.create(createBirthdayData);

    const isValid =
      typeof createDto.isValid === 'function' ? createDto.isValid() : true;
    if (!isValid) {
      let errors: string[] = [];
      if (typeof createDto.validate === 'function') {
        const raw = createDto.validate();
        if (Array.isArray(raw)) errors = raw;
        else if (raw) errors = [String(raw)];
      }
      const msg =
        errors.length > 0 ? errors.join(', ') : 'Unknown validation error';
      throw new BadRequestException(`Validation failed: ${msg}`);
    }

    try {
      const user = await this.birthdayRepository.manager
        .getRepository(User)
        .findOneBy({ id: userId });
      if (!user) {
        throw new BadRequestException('User not found');
      }
      const birthday = this.birthdayRepository.create({
        ...createDto,
        user,
      });
      const savedBirthday = await this.birthdayRepository.save(birthday);
      birthdaysCreatedTotal.inc();
      const birthdayInstance = new Birthday(savedBirthday);
      return birthdayInstance;
    } catch (error) {
      this.logger.error(
        'Error creating birthday',
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Failed to create birthday');
    }
  }

  async update(
    id: number,
    updateBirthdayData: Partial<UpdateBirthdayDto>,
    userId: number,
  ): Promise<Birthday | null> {
    const updateDto = UpdateBirthdayDto.create(updateBirthdayData);

    const isValidUpdate =
      typeof updateDto.isValid === 'function' ? updateDto.isValid() : true;
    if (!isValidUpdate) {
      let errors: string[] = [];
      if (typeof updateDto.validate === 'function') {
        const raw = updateDto.validate();
        if (Array.isArray(raw)) errors = raw;
        else if (raw) errors = [String(raw)];
      }
      const msg =
        errors.length > 0 ? errors.join(', ') : 'Unknown validation error';
      throw new BadRequestException(`Validation failed: ${msg}`);
    }

    const hasChanges =
      typeof updateDto.hasChanges === 'function'
        ? updateDto.hasChanges()
        : true;
    if (!hasChanges) throw new BadRequestException('No changes provided');

    try {
      // Empfänger einer Freigabe dürfen die geteilten Einträge bearbeiten
      const ownerIds = await this.sharingService.ownerIdsVisibleTo(userId);
      const existingBirthday = await this.birthdayRepository.findOne({
        where: { id, user: { id: In(ownerIds) } },
      });
      if (!existingBirthday) {
        return null;
      }

      const updateData: Partial<Birthday> = {};
      if (updateDto.name !== undefined) updateData.name = updateDto.name;
      if (updateDto.lastName !== undefined)
        updateData.lastName = updateDto.lastName;
      if (updateDto.dateOfBirth !== undefined)
        updateData.dateOfBirth = updateDto.dateOfBirth;
      if (updateDto.Todo !== undefined) updateData.Todo = updateDto.Todo;

      await this.birthdayRepository.update({ id }, updateData);
      const updatedBirthday = await this.birthdayRepository.findOne({
        where: { id },
      });

      if (!updatedBirthday) {
        return null;
      }
      birthdaysUpdatedTotal.inc();

      const birthdayInstance = new Birthday(updatedBirthday);

      return birthdayInstance;
    } catch (error) {
      this.logger.error(
        'Error updating birthday',
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Failed to update birthday');
    }
  }

  async remove(
    id: number,
    userId: number,
  ): Promise<{ deleted: boolean; message: string }> {
    let deleted: boolean;
    try {
      // Löschen darf nur der Besitzer, nicht der Empfänger einer Freigabe
      const result = await this.birthdayRepository.delete({
        id,
        user: { id: userId },
      });
      deleted =
        result.affected !== null &&
        result.affected !== undefined &&
        result.affected > 0;
    } catch (error) {
      this.logger.error(
        'Error deleting birthday',
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Failed to delete birthday');
    }

    if (deleted) {
      birthdaysDeletedTotal.inc();
    } else if (await this.isSharedWith(id, userId)) {
      throw new ForbiddenException(
        'Geteilte Einträge kann nur der Besitzer löschen',
      );
    }

    return {
      deleted,
      message: deleted ? 'Birthday successfully deleted' : 'Birthday not found',
    };
  }

  private async isSharedWith(id: number, userId: number): Promise<boolean> {
    const ownerIds = await this.sharingService.ownerIdsVisibleTo(userId);
    const sharedOwnerIds = ownerIds.filter((ownerId) => ownerId !== userId);
    if (sharedOwnerIds.length === 0) return false;
    return this.birthdayRepository.exists({
      where: { id, user: { id: In(sharedOwnerIds) } },
    });
  }

  async findUpcoming(
    userId: number,
    days: number = 30,
  ): Promise<UpcomingBirthdayDto[]> {
    const allBirthdays = await this.findAll(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingBirthdays: UpcomingBirthdayDto[] = [];

    for (const birthday of allBirthdays) {
      if (!birthday.dateOfBirth) continue;

      let month: number;
      let day: number;

      if (birthday.dateOfBirth.startsWith('--')) {
        month = parseInt(birthday.dateOfBirth.substring(2, 4)) - 1;
        day = parseInt(birthday.dateOfBirth.substring(5, 7));
      } else {
        const birthDate = new Date(birthday.dateOfBirth);
        month = birthDate.getMonth();
        day = birthDate.getDate();
      }

      const currentYear = today.getFullYear();
      let nextBirthday = new Date(currentYear, month, day);

      if (nextBirthday < today) {
        nextBirthday = new Date(currentYear + 1, month, day);
      }

      const diffTime = nextBirthday.getTime() - today.getTime();
      const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let age: number | null = null;
      let birthYear: number | null = null;
      if (birthday.dateOfBirth && !birthday.dateOfBirth.startsWith('--')) {
        const birthDate = new Date(birthday.dateOfBirth);
        birthYear = birthDate.getFullYear();
        age = currentYear - birthYear;
        if (nextBirthday.getFullYear() > currentYear) {
          age += 1;
        }
      }

      // Filter out birthdays with age 0 or birth year in the future
      if (birthYear && birthYear > currentYear) continue;
      if (age === 0) continue;

      if (daysUntil >= 0 && daysUntil <= days) {
        const upcomingDto = UpcomingBirthdayDto.fromBirthday(
          birthday,
          daysUntil,
          nextBirthday,
          age,
        );
        upcomingBirthdays.push(upcomingDto);
      }
    }

    upcomingBirthdays.sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);

    return upcomingBirthdays;
  }

  async getStatistics(userId: number): Promise<StatisticsDto> {
    const ownerIds = await this.sharingService.ownerIdsVisibleTo(userId);
    const total = await this.birthdayRepository.count({
      where: { user: { id: In(ownerIds) } },
    });
    const upcoming = await this.findUpcoming(userId, 30);
    const byMonth = await this.getBirthdaysByMonth(userId);

    const statistics = StatisticsDto.create({
      total,
      upcomingCount: upcoming.length,
      byMonth,
      upcoming: upcoming.slice(0, 5),
    });

    return statistics;
  }

  private async getBirthdaysByMonth(userId: number): Promise<MonthStatistic[]> {
    const birthdays = await this.findAll(userId);
    const months: MonthStatistic[] = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(2024, i).toLocaleDateString('de-DE', {
        month: 'long',
      }),
      count: 0,
    }));

    birthdays.forEach((birthday) => {
      if (birthday.dateOfBirth) {
        let month: number;
        if (birthday.dateOfBirth.startsWith('--')) {
          month = parseInt(birthday.dateOfBirth.substring(2, 4));
        } else {
          month = parseInt(birthday.dateOfBirth.substring(5, 7));
        }
        if (month >= 1 && month <= 12) {
          months[month - 1].count++;
        }
      }
    });

    return months;
  }
}

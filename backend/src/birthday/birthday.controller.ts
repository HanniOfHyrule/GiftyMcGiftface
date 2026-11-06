import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { BirthdayService } from './birthday.service';
import { Birthday } from './entities/birthday.entity';
import { StatisticsDto } from './dto/statistics.dto';
import { UpcomingBirthdayDto } from './dto/upcomingBirthday.dto';
import { CreateBirthdayDto } from './dto/createBirthday.dto';
import { UpdateBirthdayDto } from './dto/updateBirthday.dto';
import { DuplicateGroup } from './types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import {
  calendarDownloadsTotal,
  calendarFeedRequestsTotal,
  calendarUrlRegenerationsTotal,
} from '../metrics/metrics';

@Controller('birthdays')
export class BirthdayController {
  constructor(private readonly birthdayService: BirthdayService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@CurrentUser() user: AuthUser): Promise<Birthday[]> {
    const userId = user.sub;
    try {
      return await this.birthdayService.findAll(userId);
    } catch {
      throw new InternalServerErrorException('Failed to fetch birthdays');
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createBirthdayData: CreateBirthdayDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Birthday> {
    const userId = user.sub;
    const createDto = CreateBirthdayDto.create(createBirthdayData);
    if (!createDto.isValid()) {
      throw new BadRequestException(
        'Validation failed: ' + createDto.validate().join(', '),
      );
    }
    return this.birthdayService.create(createDto, userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateBirthdayData: UpdateBirthdayDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Birthday> {
    const userId = user.sub;
    const numericId = Number(id);
    if (Number.isNaN(numericId)) throw new BadRequestException('Invalid ID');
    const updateDto = UpdateBirthdayDto.create(updateBirthdayData);
    if (!updateDto.isValid()) {
      throw new BadRequestException(
        'Validation failed: ' + updateDto.validate().join(', '),
      );
    }
    const result = await this.birthdayService.update(
      numericId,
      updateDto,
      userId,
    );
    if (!result) throw new NotFoundException('Birthday not found');
    return result;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ deleted: boolean; message: string }> {
    const userId = user.sub;
    const numericId = Number(id);
    if (Number.isNaN(numericId)) throw new BadRequestException('Invalid ID');
    return this.birthdayService.remove(numericId, userId);
  }

  @Get('upcoming')
  @UseGuards(JwtAuthGuard)
  async findUpcoming(
    @CurrentUser() user: AuthUser,
    @Query('days') days?: string,
  ): Promise<UpcomingBirthdayDto[]> {
    const userId = user.sub;
    const daysNumber = days ? Number(days) : 30;
    return this.birthdayService.findUpcoming(userId, daysNumber);
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard)
  async getStatistics(@CurrentUser() user: AuthUser): Promise<StatisticsDto> {
    const userId = user.sub;
    return this.birthdayService.getStatistics(userId);
  }

  @Get('duplicates')
  @UseGuards(JwtAuthGuard)
  async findDuplicates(@CurrentUser() user: AuthUser): Promise<{
    duplicateGroups: DuplicateGroup[];
    totalGroups: number;
    totalDuplicates: number;
    message: string;
  }> {
    const userId = user.sub;
    const duplicates = await this.birthdayService.findDuplicates(userId);
    return {
      duplicateGroups: duplicates,
      totalGroups: duplicates.length,
      totalDuplicates: duplicates.reduce((sum, g) => sum + g.entries.length, 0),
      message:
        duplicates.length > 0
          ? `Found ${duplicates.length} duplicate group(s)`
          : 'No duplicates found',
    };
  }
  async generateICalFeed(userId: number): Promise<string> {
    const birthdays = await this.birthdayService.findAll(userId);
    const now = new Date();

    let ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Gifty McGiftface//Birthday Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Geburtstage',
      'X-WR-TIMEZONE:Europe/Berlin',
      'X-WR-CALDESC:Birthday reminders from Gifty McGiftface',
    ].join('\r\n');

    for (const birthday of birthdays) {
      if (!birthday.dateOfBirth) continue;

      // Stabiles Startdatum (Geburtsjahr, ohne Jahr: 2000 = Schaltjahr),
      // damit sich Termine beim Jahreswechsel nicht ändern.
      let year: string;
      let month: string;
      let day: string;

      if (birthday.dateOfBirth.startsWith('--')) {
        year = '2000';
        month = birthday.dateOfBirth.substring(2, 4);
        day = birthday.dateOfBirth.substring(5, 7);
      } else {
        [year, month, day] = birthday.dateOfBirth.split('-');
      }

      const eventDate = `${year}${month}${day}`;
      const uid = `birthday-${birthday.id}@giftymcgiftface.local`;
      const summary = this.escapeICalText(
        `🎂 ${birthday.name} ${birthday.lastName}`,
      );
      const description = birthday.Todo
        ? this.escapeICalText(`Todo: ${birthday.Todo}`)
        : '';

      ical +=
        '\r\n' +
        [
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${this.formatICalDate(now)}`,
          `DTSTART;VALUE=DATE:${eventDate}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${description}`,
          'RRULE:FREQ=YEARLY',
          'BEGIN:VALARM',
          'TRIGGER:-P1D',
          'ACTION:DISPLAY',
          `DESCRIPTION:${summary} has a birthday tomorrow!`,
          'END:VALARM',
          'END:VEVENT',
        ].join('\r\n');
    }

    ical += '\r\nEND:VCALENDAR';

    return ical;
  }

  private formatICalDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  @Get('calendar/ics')
  @UseGuards(JwtAuthGuard)
  async getICalFeed(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const userId = user.sub;
      const icsContent = await this.generateICalFeed(userId);

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="birthdays.ics"',
      );
      res.send(icsContent);
      calendarDownloadsTotal.inc();
    } catch {
      throw new InternalServerErrorException(
        'Failed to generate calendar feed',
      );
    }
  }

  // Öffentlicher Feed für Kalender-Abos (Proton, Google, Apple, ...).
  // Diese Dienste können keinen Authorization-Header senden, daher
  // authentifiziert der geheime Token in der URL.
  @Get('calendar/feed/:file')
  async getPublicICalFeed(
    @Param('file') file: string,
    @Res() res: Response,
  ): Promise<void> {
    const token = file.replace(/\.ics$/, '');
    if (!/^[a-f0-9]{64}$/.test(token)) {
      calendarFeedRequestsTotal.inc({ result: 'not_found' });
      throw new NotFoundException('Calendar not found');
    }
    const userId = await this.birthdayService.findUserIdByCalendarToken(token);
    if (userId === null) {
      calendarFeedRequestsTotal.inc({ result: 'not_found' });
      throw new NotFoundException('Calendar not found');
    }

    const icsContent = await this.generateICalFeed(userId);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="birthdays.ics"');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(icsContent);
    calendarFeedRequestsTotal.inc({ result: 'served' });
  }

  @Get('calendar/url')
  @UseGuards(JwtAuthGuard)
  async getCalendarUrl(
    @CurrentUser() user: AuthUser,
  ): Promise<{ path: string }> {
    const token = await this.birthdayService.getOrCreateCalendarToken(user.sub);
    return { path: `/birthdays/calendar/feed/${token}.ics` };
  }

  @Post('calendar/url/regenerate')
  @UseGuards(JwtAuthGuard)
  async regenerateCalendarUrl(
    @CurrentUser() user: AuthUser,
  ): Promise<{ path: string }> {
    const token = await this.birthdayService.regenerateCalendarToken(user.sub);
    calendarUrlRegenerationsTotal.inc();
    return { path: `/birthdays/calendar/feed/${token}.ics` };
  }

  private escapeICalText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }
}

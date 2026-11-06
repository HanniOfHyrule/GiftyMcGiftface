import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { SyncResult, TodoistService, TodoistStatus } from './todoist.service';
import { UpdateTodoistSettingsDto } from './dto/update-todoist-settings.dto';
import { todoistConnectionsTotal } from '../metrics/metrics';

@Controller('todoist')
export class TodoistController {
  private readonly logger = new Logger(TodoistController.name);

  constructor(private readonly todoistService: TodoistService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  getStatus(@CurrentUser() user: AuthUser): Promise<TodoistStatus> {
    return this.todoistService.getStatus(user.sub);
  }

  @Get('authorize-url')
  @UseGuards(JwtAuthGuard)
  getAuthorizeUrl(@CurrentUser() user: AuthUser): { url: string } {
    return { url: this.todoistService.createAuthorizationUrl(user.sub) };
  }

  // Todoist leitet den Browser nach dem Login hierher zurück (ohne JWT);
  // der signierte State identifiziert den User.
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const target = `${this.todoistService.appUrl()}/dashboard`;
    if (error || !code || !state) {
      const result = error === 'access_denied' ? 'denied' : 'error';
      todoistConnectionsTotal.inc({ result });
      res.redirect(`${target}?todoist=${result}`);
      return;
    }
    try {
      await this.todoistService.handleCallback(code, state);
      todoistConnectionsTotal.inc({ result: 'connected' });
      res.redirect(`${target}?todoist=connected`);
    } catch (err) {
      this.logger.warn(`Todoist-Verbindung fehlgeschlagen: ${String(err)}`);
      todoistConnectionsTotal.inc({ result: 'error' });
      res.redirect(`${target}?todoist=error`);
    }
  }

  @Put('settings')
  @UseGuards(JwtAuthGuard)
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTodoistSettingsDto,
  ): Promise<TodoistStatus> {
    return this.todoistService.updateSettings(user.sub, dto);
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  sync(@CurrentUser() user: AuthUser): Promise<SyncResult> {
    return this.todoistService.syncUser(user.sub, 'manual');
  }

  @Delete('connection')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@CurrentUser() user: AuthUser): Promise<void> {
    await this.todoistService.disconnect(user.sub);
  }
}

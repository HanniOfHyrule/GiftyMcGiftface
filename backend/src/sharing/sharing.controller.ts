import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { SharingService } from './sharing.service';
import { CreateShareDto } from './dto/create-share.dto';
import { ShareDto, SharesOverviewDto } from './dto/share.dto';

@Controller('shares')
@UseGuards(JwtAuthGuard)
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<SharesOverviewDto> {
    return this.sharingService.list(user.sub);
  }

  @Post()
  invite(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateShareDto,
  ): Promise<ShareDto> {
    return this.sharingService.invite(user.sub, dto.email);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ShareDto> {
    return this.sharingService.accept(user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.sharingService.remove(user.sub, id);
  }
}

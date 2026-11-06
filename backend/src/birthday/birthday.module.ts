import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BirthdayService } from './birthday.service';
import { BirthdayController } from './birthday.controller';
import { Birthday } from './entities/birthday.entity';
import { User } from '../user/entities/user.entity';
import { SharingModule } from '../sharing/sharing.module';

@Module({
  imports: [TypeOrmModule.forFeature([Birthday, User]), SharingModule],
  controllers: [BirthdayController],
  providers: [BirthdayService],
  exports: [BirthdayService],
})
export class BirthdayModule {}

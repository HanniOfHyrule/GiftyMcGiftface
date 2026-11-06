import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Birthday } from '../birthday/entities/birthday.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Birthday])],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

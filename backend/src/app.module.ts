import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BirthdayModule } from './birthday/birthday.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { TodoistModule } from './todoist/todoist.module';
import { MetricsModule } from './metrics/metrics.module';
import { SharingModule } from './sharing/sharing.module';
import { AppDataSource } from './data-source';

@Module({
  imports: [
    TypeOrmModule.forRoot(AppDataSource.options),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    BirthdayModule,
    UserModule,
    AuthModule,
    TodoistModule,
    SharingModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

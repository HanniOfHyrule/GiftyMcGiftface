import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BirthdayModule } from '../birthday/birthday.module';
import { TodoistConnection } from './entities/todoist-connection.entity';
import { TodoistTask } from './entities/todoist-task.entity';
import { TodoistController } from './todoist.controller';
import { TodoistService } from './todoist.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TodoistConnection, TodoistTask]),
    BirthdayModule,
  ],
  controllers: [TodoistController],
  providers: [TodoistService],
})
export class TodoistModule {}

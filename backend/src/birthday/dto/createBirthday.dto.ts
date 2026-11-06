import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TodoType } from '../entities/birthday.entity';

export class CreateBirthdayDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lastName!: string;
  // YYYY-MM-DD oder --MM-DD (ohne Jahr); leer erlaubt
  @ValidateIf((o: { dateOfBirth?: string }) => !!o.dateOfBirth)
  @Matches(/^(\d{4}|-)-\d{2}-\d{2}$/)
  dateOfBirth?: string;
  @IsOptional()
  @IsEnum(TodoType)
  Todo!: TodoType;
  @IsOptional()
  @IsUUID()
  entryId?: string;

  constructor(data?: Partial<CreateBirthdayDto>) {
    if (data) {
      this.name = data.name?.trim() || '';
      this.lastName = data.lastName?.trim() || '';
      this.dateOfBirth = data.dateOfBirth || undefined;
      this.Todo = data.Todo || TodoType.NEEDPRESENT;
      this.entryId = data.entryId;
    }
  }

  static create(data: Partial<CreateBirthdayDto>): CreateBirthdayDto {
    return new CreateBirthdayDto(data);
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Name is required');
    }
    if (!this.lastName || this.lastName.trim().length === 0) {
      errors.push('Last name is required');
    }
    if (!Object.values(TodoType).includes(this.Todo)) {
      errors.push(
        `Invalid Todo value. Must be one of: ${Object.values(TodoType).join(', ')}`,
      );
    }

    return errors;
  }

  isValid(): boolean {
    return this.validate().length === 0;
  }
}

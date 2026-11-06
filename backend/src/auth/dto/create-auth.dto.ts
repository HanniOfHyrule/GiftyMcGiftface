import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAuthDto {
  constructor(email: string, password: string, name: string, lastName: string) {
    this.email = email;
    this.password = password;
    this.name = name;
    this.lastName = lastName;
  }
  @IsEmail()
  @MaxLength(255)
  email: string;

  // bcrypt verarbeitet maximal 72 Bytes
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lastName: string;
}

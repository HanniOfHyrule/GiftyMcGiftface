import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginAuthDto {
  constructor(email: string, password: string) {
    this.email = email;
    this.password = password;
  }
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

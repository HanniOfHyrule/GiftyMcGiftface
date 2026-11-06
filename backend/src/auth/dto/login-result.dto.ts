export class LoginResultDto {
  constructor(
    public message: string,
    public userId: number,
    public email: string,
    public name: string,
    public lastName: string,
    public token: string,
    public refreshToken: string,
  ) {}
}

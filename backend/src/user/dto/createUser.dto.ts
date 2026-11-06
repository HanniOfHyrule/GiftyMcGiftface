export class CreateUserDto {
  email!: string;
  password!: string;
  name!: string;
  lastName!: string;

  constructor(data?: Partial<CreateUserDto>) {
    if (data) {
      this.email = data.email?.trim() || '';
      this.password = data.password || '';
      this.name = data.name?.trim() || '';
      this.lastName = data.lastName?.trim() || '';
    }
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.email || this.email.trim().length === 0) {
      errors.push('Email is required');
    } else if (!/\S+@\S+\.\S+/.test(this.email)) {
      errors.push('Email is invalid');
    }

    if (!this.password || this.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Name is required');
    }
    if (!this.lastName || this.lastName.trim().length === 0) {
      errors.push('Last name is required');
    }
    return errors;
  }
  isValid(): boolean {
    return this.validate().length === 0;
  }
}

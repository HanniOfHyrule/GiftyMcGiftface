export class UpdateUserDto {
  email?: string;
  name?: string;
  lastName?: string;

  constructor(data?: Partial<UpdateUserDto>) {
    if (data) {
      this.email = data.email?.trim() || undefined;
      this.name = data.name?.trim() || undefined;
      this.lastName = data.lastName?.trim() || undefined;
    }
  }

  validate(): string[] {
    const errors: string[] = [];

    if (this.email !== undefined) {
      if (this.email.trim().length === 0) {
        errors.push('Email cannot be empty');
      } else if (!/\S+@\S+\.\S+/.test(this.email)) {
        errors.push('Email is invalid');
      }
    }

    if (this.name !== undefined && this.name.trim().length === 0) {
      errors.push('Name cannot be empty');
    }
    if (this.lastName !== undefined && this.lastName.trim().length === 0) {
      errors.push('Last name cannot be empty');
    }
    return errors;
  }
  isValid(): boolean {
    return this.validate().length === 0;
  }
}

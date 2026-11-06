export class CsvImportResultDto {
  imported: number;
  errors: string[];
  totalRows: number;
  successRate: number;

  constructor(
    imported: number = 0,
    errors: string[] = [],
    totalRows: number = 0,
  ) {
    this.imported = imported;
    this.errors = errors;
    this.totalRows = totalRows;
    this.successRate =
      totalRows > 0 ? Math.round((imported / totalRows) * 100) : 0;
  }

  static create(
    imported: number,
    errors: string[],
    totalRows: number,
  ): CsvImportResultDto {
    return new CsvImportResultDto(imported, errors, totalRows);
  }

  get hasErrors(): boolean {
    return this.errors.length > 0;
  }

  get wasSuccessful(): boolean {
    return this.imported > 0 && this.errors.length === 0;
  }

  get wasPartiallySuccessful(): boolean {
    return this.imported > 0 && this.errors.length > 0;
  }

  addError(error: string): void {
    this.errors.push(error);
  }

  incrementImported(): void {
    this.imported++;
    this.updateSuccessRate();
  }

  private updateSuccessRate(): void {
    this.successRate =
      this.totalRows > 0
        ? Math.round((this.imported / this.totalRows) * 100)
        : 0;
  }
}

import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateTodoistSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  presentLeadDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  cardLeadDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  whatsappLeadDays?: number;
}

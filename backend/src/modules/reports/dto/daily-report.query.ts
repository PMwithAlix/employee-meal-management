import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class DailyReportQueryDto {
  @ApiProperty({ example: '2026-11-16' })
  @IsDateString()
  mealDate!: string;
}

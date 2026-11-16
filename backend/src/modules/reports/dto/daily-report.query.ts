import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { REPORT_MEALS, type ReportMealFilter } from '../report-common';

export class DailyReportQueryDto {
  @ApiProperty({ example: '2026-11-16' })
  @IsDateString()
  mealDate!: string;

  @ApiPropertyOptional({ enum: REPORT_MEALS, default: 'ALL' })
  @IsOptional()
  @IsIn(REPORT_MEALS)
  meal: ReportMealFilter = 'ALL';
}

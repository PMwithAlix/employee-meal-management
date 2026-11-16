import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { REPORT_MEALS, type ReportMealFilter } from '../report-common';

export class MonthlyReportQueryDto {
  @ApiProperty({ description: 'سال جلالی' })
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year!: number;

  @ApiProperty({ description: 'ماه جلالی (۱ تا ۱۲)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiPropertyOptional({ enum: REPORT_MEALS, default: 'ALL' })
  @IsOptional()
  @IsIn(REPORT_MEALS)
  meal: ReportMealFilter = 'ALL';
}

import { ApiProperty } from '@nestjs/swagger';
import { MealType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  ValidateNested,
} from 'class-validator';

export class DeadlineItemDto {
  @ApiProperty({ example: '2026-08-23' })
  @IsDateString()
  mealDate!: string;

  @ApiProperty({ enum: MealType })
  @IsEnum(MealType)
  mealType!: MealType;

  @ApiProperty({
    example: '2026-08-22T06:30:00.000Z',
    description: 'زمان مهلت به‌صورت ISO-8601 (UTC). مقایسه با now < deadlineAt',
  })
  @IsDateString()
  deadlineAt!: string;
}

export class UpsertDeadlinesDto {
  @ApiProperty({ type: [DeadlineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeadlineItemDto)
  items!: DeadlineItemDto[];
}

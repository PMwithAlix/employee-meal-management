import { ApiProperty } from '@nestjs/swagger';
import { MealType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  Matches,
  ValidateNested,
} from 'class-validator';

export class MealSettingItemDto {
  @ApiProperty({ enum: MealType })
  @IsEnum(MealType)
  mealType!: MealType;

  @ApiProperty({ example: '12:00', description: 'ساعت وعده در Asia/Tehran' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  servingTime!: string;
}

export class UpsertMealSettingsDto {
  @ApiProperty({ type: [MealSettingItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MealSettingItemDto)
  items!: MealSettingItemDto[];
}

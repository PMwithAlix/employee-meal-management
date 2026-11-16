import { ApiProperty } from '@nestjs/swagger';
import { DeadlineDayRelation, MealType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class DeadlinePolicyItemDto {
  @ApiProperty({ enum: MealType })
  @IsEnum(MealType)
  mealType!: MealType;

  @ApiProperty({ enum: DeadlineDayRelation })
  @IsEnum(DeadlineDayRelation)
  relation!: DeadlineDayRelation;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  @Max(23)
  hour!: number;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  @Max(59)
  minute!: number;
}

export class UpsertDeadlinePolicyDto {
  @ApiProperty({ type: [DeadlinePolicyItemDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => DeadlinePolicyItemDto)
  items!: DeadlinePolicyItemDto[];
}

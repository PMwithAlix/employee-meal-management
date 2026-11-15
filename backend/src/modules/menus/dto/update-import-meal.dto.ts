import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MealType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImportMealOptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  id?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  displayOrder?: number;
}

export class UpdateImportMealDto {
  @ApiProperty({ example: '2026-08-23' })
  @IsDateString()
  mealDate!: string;

  @ApiProperty({ enum: MealType })
  @IsEnum(MealType)
  mealType!: MealType;

  @ApiProperty({ type: [ImportMealOptionDto] })
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ImportMealOptionDto)
  options!: ImportMealOptionDto[];
}

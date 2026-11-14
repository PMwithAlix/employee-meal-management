import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MealType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateOrderDto {
  @ApiPropertyOptional({
    description: 'فقط SUPPORT/ADMIN برای سفارش به‌جای کارمند',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ example: '2026-08-23' })
  @IsDateString()
  mealDate!: string;

  @ApiProperty({ enum: MealType })
  @IsEnum(MealType)
  mealType!: MealType;

  @ApiProperty()
  @IsUUID()
  menuItemId!: string;
}

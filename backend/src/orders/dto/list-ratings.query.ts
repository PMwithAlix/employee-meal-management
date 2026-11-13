import { ApiPropertyOptional } from '@nestjs/swagger';
import { MealType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.query';

export class ListRatingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  mealDate?: string;

  @ApiPropertyOptional({ enum: MealType })
  @IsOptional()
  @IsEnum(MealType)
  mealType?: MealType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;
}

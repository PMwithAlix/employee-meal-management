import { ApiPropertyOptional } from '@nestjs/swagger';
import { GuestOrderStatus, MealType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.query';

export class ListGuestOrdersQueryDto extends PaginationQueryDto {
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
  buildingId?: string;

  @ApiPropertyOptional({ enum: GuestOrderStatus })
  @IsOptional()
  @IsEnum(GuestOrderStatus)
  status?: GuestOrderStatus;
}

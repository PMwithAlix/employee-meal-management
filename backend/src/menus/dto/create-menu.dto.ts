import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class CreateMenuDto {
  @ApiProperty({ description: 'سال جلالی ماه منو' })
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
}

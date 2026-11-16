import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AnnounceMenuDto {
  @ApiProperty({ example: 'منوی آبان آماده است 🍽️' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    example: 'برای مشاهده منو و ثبت وعده‌های غذایی وارد سامانه شوید.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  body!: string;
}

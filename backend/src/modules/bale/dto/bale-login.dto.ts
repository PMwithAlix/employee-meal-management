import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BaleLoginDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4096)
  initData!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  username!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  chatId?: string;
}

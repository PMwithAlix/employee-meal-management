import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class CreateVersionDto {
  @ApiPropertyOptional({
    description:
      'نادیده گرفته می‌شود. منوی ماه فقط یک نسخه جاری دارد و پیش‌نویس جدید ساخته نمی‌شود.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  sourceVersionId?: string | null;
}

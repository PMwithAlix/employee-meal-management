import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class CreateVersionDto {
  @ApiPropertyOptional({
    description:
      'نسخه مبدأ برای کپی. پیش‌فرض نسخه منتشرشده جاری است. null یعنی پیش‌نویس خالی.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  sourceVersionId?: string | null;
}

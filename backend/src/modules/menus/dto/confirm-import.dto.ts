import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ImportPolicy } from '../menu.types';

export class ConfirmImportDto {
  @ApiProperty({ enum: ImportPolicy })
  @IsIn(Object.values(ImportPolicy))
  policy!: ImportPolicy;
}

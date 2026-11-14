import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateOrderDto {
  @ApiProperty()
  @IsUUID()
  menuItemId!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class CreateOrderDTO {
  @IsUUID(undefined, { each: true })
  @IsArray()
  @ArrayNotEmpty()
  @ApiProperty({ example: ['5fccee35-27a3-49f5-9fc1-d547be8cc266'] })
  productsIds: string[];
}

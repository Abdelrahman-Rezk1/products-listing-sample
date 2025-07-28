import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateProductDTO {
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  @ApiProperty({ example: 'Product-1' })
  name: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'Product Description' })
  description?: string;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ example: 100 })
  price: number;
}

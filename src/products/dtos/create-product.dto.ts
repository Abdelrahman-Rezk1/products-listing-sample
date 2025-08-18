// src/products/dtos/create-product.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  IsInt,
  Min,
} from 'class-validator';

export class CreateProductDTO {
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  @ApiProperty({ example: 'Wireless Keyboard' })
  name: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'Slim 2.4GHz wireless keyboard', required: false })
  description?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'KB-123', required: false })
  code?: string;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ example: 49.99 })
  unitPrice: number;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'Logitech', required: false })
  manufacturer?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'SKU-001', required: false })
  sku?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @ApiProperty({ example: 100, required: false })
  qtyInStock?: number;
}

import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMinSize,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * One Zoho Products record payload.
 * Field names match Zoho CRM Products module API names.
 */
export class ZohoProductRecordDto {
  @ApiPropertyOptional({
    description: 'Zoho: Product_Name',
    example: 'Wireless Keyboard',
  })
  @IsOptional()
  @IsString()
  Product_Name?: string;

  @ApiPropertyOptional({
    description: 'Zoho: Description',
    example: 'Slim 2.4GHz wireless keyboard',
  })
  @IsOptional()
  @IsString()
  Description?: string;

  @ApiPropertyOptional({ description: 'Zoho: Product_Code', example: 'KB-123' })
  @IsOptional()
  @IsString()
  Product_Code?: string;

  @ApiPropertyOptional({ description: 'Zoho: Unit_Price', example: 49.99 })
  @IsOptional()
  @IsNumber()
  Unit_Price?: number;

  @ApiPropertyOptional({
    description: 'Zoho: Manufacturer',
    example: 'Logitech',
  })
  @IsOptional()
  @IsString()
  Manufacturer?: string;

  @ApiPropertyOptional({ description: 'Zoho: SKU', example: 'SKU-001' })
  @IsOptional()
  @IsString()
  SKU?: string;

  @ApiPropertyOptional({ description: 'Zoho: Qty_in_Stock', example: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  Qty_in_Stock?: number;
}

/**
 * Full Zoho Records API payload for Products:
 * { data: [ { ...Zoho fields... } ] }
 */
export class ZohoProductPayloadDto {
  @ApiProperty({
    description: 'Array of Zoho Products records (at least one)',
    type: [ZohoProductRecordDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ZohoProductRecordDto)
  data!: ZohoProductRecordDto[];
}

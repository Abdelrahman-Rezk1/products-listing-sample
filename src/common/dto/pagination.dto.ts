import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class PaginationDTO {
  @IsNumber()
  @IsOptional()
  @ApiProperty({ example: 1 })
  page?: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty({ example: 10 })
  limit?: number;
}

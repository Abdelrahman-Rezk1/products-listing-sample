import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDTO } from './dtos/create-product.dto';
import { UpdateProductDTO } from './dtos/update-product.dto';
import { IdDTO } from 'src/common/dto/id.dto';
import { PaginationDTO } from 'src/common/dto/pagination.dto';
import { DeleteResult, UpdateResult } from 'typeorm';
import { Product } from './entities/product.entity';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiBody({ type: CreateProductDTO })
  @ApiCreatedResponse({
    description: 'Product created successfully.',
    type: Product,
  })
  async create(@Body() payload: CreateProductDTO) {
    return this.service.create(payload);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Product ID' })
  @ApiBody({ type: UpdateProductDTO })
  @ApiOkResponse({
    description: 'Product updated successfully.',
    type: UpdateResult,
  })
  async update(@Param() idPayload: IdDTO, @Body() payload: UpdateProductDTO) {
    return this.service.update(idPayload.id, payload);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Product ID' })
  @ApiOkResponse({ description: 'Product found.', type: Product })
  async readOne(@Param() idPayload: IdDTO) {
    return this.service.readOne(idPayload);
  }

  @Get()
  @ApiOperation({ summary: 'Get a list of products with pagination' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max results to return',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Results to skip',
  })
  @ApiOkResponse({
    description: 'List of products.',
    type: Promise<{ products: Product[]; total: number }>,
  })
  async read(@Query() payload: PaginationDTO) {
    return this.service.read(payload);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Product ID' })
  @ApiResponse({
    description: 'Product deleted successfully.',
    type: DeleteResult,
  })
  async delete(@Param() idPayload: IdDTO) {
    return this.service.delete(idPayload);
  }
}

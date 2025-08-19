import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDTO } from './dtos/create-product.dto';
import { UpdateProductDTO } from './dtos/update-product.dto';
import { IdDTO } from 'src/common/dto/id.dto';
import { PaginationDTO } from 'src/common/dto/pagination.dto';
import { DeleteResult, UpdateResult } from 'typeorm';
import { Product } from './entities/product.entity';
import { ZohoAuthCtx } from 'src/common/types/zoho-oauth.types';

const ACCESS_COOKIE = 'zoho_access_token';
const API_DOMAIN_COOKIE = 'zoho_api_domain';
const API_DOMAIN_FALLBACK = 'https://www.zohoapis.sa';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  private extractCtx(req: Request): ZohoAuthCtx {
    const accessToken = req.cookies?.[ACCESS_COOKIE];
    if (!accessToken)
      throw new UnauthorizedException('Zoho access token is missing.');
    const apiDomain = req.cookies?.[API_DOMAIN_COOKIE] || API_DOMAIN_FALLBACK;
    return { accessToken, apiDomain };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search products (Algolia)' })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Query text',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page (1-based). Default 1',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Hits per page. Default 20',
  })
  @ApiOkResponse({
    description: 'Algolia results',
    schema: {
      example: {
        hits: [
          {
            objectID: 'uuid',
            name: 'Widget',
            unitPrice: 49.99,
            inStock: true,
            manufacturer: 'Acme',
          },
        ],
        nbHits: 1,
        page: 0,
        hitsPerPage: 20,
      },
    },
  })
  async search(
    @Query('q') q = '',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const hitsPerPage = Math.max(1, Math.min(1000, Number(limit) || 20));
    return this.service.search(q, pageNum, hitsPerPage);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new product (Zoho + local)' })
  @ApiBody({ type: CreateProductDTO })
  @ApiCreatedResponse({ description: 'Product created.', type: Product })
  async create(@Req() req: Request, @Body() payload: CreateProductDTO) {
    const ctx = this.extractCtx(req);
    return this.service.create(payload, ctx);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product by ID (Zoho if linked + local)' })
  @ApiParam({ name: 'id', type: String, description: 'Local product UUID' })
  @ApiBody({ type: UpdateProductDTO })
  @ApiOkResponse({ description: 'Product updated.', type: UpdateResult })
  async update(
    @Req() req: Request,
    @Param() idPayload: IdDTO,
    @Body() payload: UpdateProductDTO,
  ) {
    const ctx = this.extractCtx(req);
    return this.service.update(idPayload.id, payload, ctx);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by local UUID' })
  @ApiParam({ name: 'id', type: String, description: 'Local product UUID' })
  @ApiOkResponse({ description: 'Product found.', type: Product })
  async readOne(@Param() idPayload: IdDTO) {
    return this.service.readOne(idPayload);
  }

  @Get()
  @ApiOperation({ summary: 'List products (local mirror, paginated)' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page (1-based)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size',
  })
  @ApiOkResponse({
    description: 'List of products.',
    schema: {
      example: {
        products: [{ id: '...', name: '...', unitPrice: 49.99, zohoId: '...' }],
        total: 1,
      },
    },
  })
  async read(@Query() payload: PaginationDTO) {
    return this.service.read(payload);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete product (Zoho if linked + local)' })
  @ApiParam({ name: 'id', type: String, description: 'Local product UUID' })
  @ApiResponse({
    description: 'Product deleted successfully.',
    type: DeleteResult,
  })
  async delete(@Req() req: Request, @Param() idPayload: IdDTO) {
    const ctx = this.extractCtx(req);
    return this.service.delete(idPayload, ctx);
  }
}

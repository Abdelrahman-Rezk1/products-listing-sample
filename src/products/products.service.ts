import {
  Injectable,
  MethodNotAllowedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, In, Repository, UpdateResult } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDTO } from './dtos/create-product.dto';
import { UpdateProductDTO } from './dtos/update-product.dto';
import { IdDTO } from 'src/common/dto/id.dto';
import { PaginationDTO } from 'src/common/dto/pagination.dto';
import { ZohoAuthCtx } from 'src/common/types/zoho-oauth.types';
import { ProductsIndexer } from './products.indexer';

// ⬇️ NEW: dynamic mapping imports
import { MappingEntity } from 'src/common/enums/field-mapping.enums';
import { FieldsMappingService } from 'src/fields-mapping/fields-mapping.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    private readonly indexer: ProductsIndexer,
    private readonly mapping: FieldsMappingService,
  ) {}

  async create(payload: CreateProductDTO, ctx: ZohoAuthCtx): Promise<Product> {
    // Build Zoho record using dynamic mapping (sparse=true → only provided fields)
    const record = await this.mapping.toZoho(MappingEntity.Product, payload, {
      sparse: true,
    });
    const body = { data: [record] };

    // Create in Zoho
    const zohoResponse = await this.zohoFetch(
      '/Products',
      { method: 'POST', body: JSON.stringify(body) },
      ctx,
    );

    const first = zohoResponse?.data?.[0];
    const zohoId: string | undefined = first?.details?.id;
    if (!zohoId || first?.status !== 'success') {
      throw new BadRequestException(
        `Zoho create failed: ${JSON.stringify(first)}`,
      );
    }

    // Mirror locally
    const product = this.productsRepository.create({
      zohoId,
      name: payload.name,
      description: payload.description ?? null,
      code: payload.code ?? null,
      unitPrice: payload.unitPrice,
      manufacturer: payload.manufacturer ?? null,
      sku: payload.sku ?? null,
      qtyInStock: payload.qtyInStock ?? null,
    });
    const saved = await this.productsRepository.save(product);

    // ALGOLIA: upsert
    try {
      await this.indexer.upsert(saved);
    } catch (e) {
      this.logger.error(
        `Algolia upsert failed on create ${saved.id}: ${String(e)}`,
      );
    }

    return saved;
  }

  async read(
    payload: PaginationDTO,
  ): Promise<{ products: Product[]; total: number }> {
    const { page = 1, limit = 10 } = payload;
    const [products, total] = await this.productsRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });
    return { products, total };
  }

  async readByIdList(idList: string[]) {
    const products = await this.productsRepository.find({
      where: { id: In(idList) },
    });
    if (products.length !== idList.length)
      throw new NotFoundException('Some products not found');
    return products;
  }

  async readOne(payload: IdDTO): Promise<Product | null> {
    return this.productsRepository.findOne({ where: { id: payload.id } });
  }

  async update(
    id: string,
    payload: UpdateProductDTO,
    ctx: ZohoAuthCtx,
  ): Promise<UpdateResult> {
    const existing = await this.productsRepository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');

    if (existing.zohoId) {
      // Sparse mapping so we only send fields present in payload (PATCH semantics)
      const record = await this.mapping.toZoho(MappingEntity.Product, payload, {
        sparse: true,
      });
      const body = { data: [record] };

      const zohoResponse = await this.zohoFetch(
        `/Products/${existing.zohoId}`,
        {
          method: 'PUT',
          body: JSON.stringify(body),
        },
        ctx,
      );
      const first = zohoResponse?.data?.[0];
      if (first?.status !== 'success') {
        throw new BadRequestException(
          `Zoho update failed: ${JSON.stringify(first)}`,
        );
      }
    }

    const toSave = this.productsRepository.create({ ...existing, ...payload });
    const result = await this.productsRepository.update(id, toSave);

    // ALGOLIA: fetch fresh entity then upsert
    try {
      const fresh = await this.productsRepository.findOne({ where: { id } });
      if (fresh) await this.indexer.upsert(fresh);
    } catch (e) {
      this.logger.error(`Algolia upsert failed on update ${id}: ${String(e)}`);
    }

    return result;
  }

  async delete(payload: IdDTO, ctx: ZohoAuthCtx): Promise<DeleteResult> {
    const product = await this.productsRepository.findOne({
      where: { id: payload.id },
      relations: ['orders'],
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.orders?.length)
      throw new MethodNotAllowedException('This product is assigned to orders');

    if (product.zohoId) {
      await this.zohoFetch(
        `/Products/${product.zohoId}`,
        { method: 'DELETE' },
        ctx,
      );
    }

    const res = await this.productsRepository.delete(payload.id);

    // ALGOLIA: remove
    try {
      await this.indexer.remove(payload.id);
    } catch (e) {
      this.logger.error(
        `Algolia remove failed on delete ${payload.id}: ${String(e)}`,
      );
    }

    return res;
  }

  async search(query: string, page = 1, hitsPerPage = 20) {
    const algoliaPage = Math.max(0, (page || 1) - 1);
    return this.indexer.search(query, algoliaPage, hitsPerPage);
  }

  private async zohoFetch(
    path: string,
    init: RequestInit,
    ctx: ZohoAuthCtx,
  ): Promise<any> {
    const res = await fetch(`${ctx.apiDomain}/crm/v8${path}`, {
      ...init,
      headers: {
        Authorization: `Zoho-oauthtoken ${ctx.accessToken}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });

    const text = await res.text();
    if (!res.ok)
      throw new BadRequestException(`Zoho API ${res.status}: ${text}`);
    return text ? JSON.parse(text) : {};
  }
}

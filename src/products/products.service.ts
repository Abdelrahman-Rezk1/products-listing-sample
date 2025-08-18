// src/products/products.service.ts
import {
  Injectable,
  MethodNotAllowedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, In, Repository, UpdateResult } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDTO } from './dtos/create-product.dto';
import { UpdateProductDTO } from './dtos/update-product.dto';
import { IdDTO } from 'src/common/dto/id.dto';
import { PaginationDTO } from 'src/common/dto/pagination.dto';
import { ZohoAuthCtx } from 'src/common/types/zoho-oauth.types';
import {
  ZohoProductPayloadDto,
  ZohoProductRecordDto,
} from './dtos/zoho-product-payload.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async create(payload: CreateProductDTO, ctx: ZohoAuthCtx): Promise<Product> {
    // Create in Zoho
    const body = this.toZohoPayload(payload);
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
    return this.productsRepository.save(product);
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
      const body = this.toZohoPayload(payload);
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
    return this.productsRepository.update(id, toSave);
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
      const z = await this.zohoFetch(
        `/Products/${product.zohoId}`,
        { method: 'DELETE' },
        ctx,
      );
      // z may contain status array; optional check
    }

    return this.productsRepository.delete(payload.id);
  }

  /**
   * Internal helper to call the Zoho CRM v8 REST API with the provided auth context.
   *
   * Builds the request URL as `${ctx.apiDomain}/crm/v8${path}`, adds the
   * `Authorization: Zoho-oauthtoken <accessToken>` header, and sets a default
   * `Content-Type: application/json` (your `init.headers` can override/extend it).
   *
   * The response body is read as text and parsed as JSON if non-empty.
   * For any non-OK HTTP status (`res.ok === false`), a `BadRequestException`
   * is thrown with the status code and raw response text for easier debugging.
   *
   * @param path - Relative Zoho CRM API path **starting with a slash**, e.g.
   * `'/Products'`, `'/Products/{id}'`, `'/Products/search'`.
   * @param init - Standard `fetch` options (method, body, headers, etc.).
   *   When sending JSON (e.g., POST/PUT), pass a stringified body:
   *   `body: JSON.stringify({ data: [...] })`. Any headers provided here
   *   will be merged with (and can override) the defaults.
   * @param ctx - Zoho auth context containing:
   *   - `apiDomain`: The base domain returned by Zoho (e.g. `https://www.zohoapis.sa`).
   *   - `accessToken`: The OAuth access token to use in the `Authorization` header.
   *
   * @returns A promise resolving to the parsed JSON response object, or `{}` if the
   * response has no body (e.g. 204).
   *
   * @throws {BadRequestException} If the HTTP response status is not OK (non-2xx).
   *
   */

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

  /**
   * Maps our Create/Update DTOs to Zoho Products payload DTO.
   */
  private toZohoPayload(
    dto: CreateProductDTO | UpdateProductDTO,
  ): ZohoProductPayloadDto {
    const rec: ZohoProductRecordDto = {};

    if (dto.name !== undefined) rec.Product_Name = dto.name;
    if (dto.description !== undefined) rec.Description = dto.description;
    if (dto.code !== undefined) rec.Product_Code = dto.code;
    if (dto.unitPrice !== undefined) rec.Unit_Price = dto.unitPrice;
    if (dto.manufacturer !== undefined) rec.Manufacturer = dto.manufacturer;
    if (dto.sku !== undefined) rec.SKU = dto.sku;
    if (dto.qtyInStock !== undefined) rec.Qty_in_Stock = dto.qtyInStock;

    return { data: [rec] };
  }
}

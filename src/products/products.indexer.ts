import { Inject, Injectable } from '@nestjs/common';
import {
  ALGOLIA_CLIENT,
  ALGOLIA_INDEX_NAMES,
  AlgoliaClient,
  IndexNames,
} from 'src/algolia/alogolia.module';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsIndexer {
  constructor(
    @Inject(ALGOLIA_CLIENT) private readonly algolia: AlgoliaClient,
    @Inject(ALGOLIA_INDEX_NAMES) private readonly names: IndexNames,
  ) {}

  async configure() {
    const { taskID } = await this.algolia.setSettings({
      indexName: this.names.products,
      indexSettings: {
        searchableAttributes: [
          'name',
          'manufacturer',
          'sku',
          'code',
          'description',
        ],
        attributesForFaceting: [
          'filterOnly(manufacturer)',
          'filterOnly(sku)',
          'filterOnly(zohoId)',
          'inStock',
        ],
      },
    });
    await this.algolia.waitForTask({ indexName: this.names.products, taskID });
  }

  private toRecord(p: Product) {
    return {
      objectID: p.id,
      name: p.name,
      description: p.description ?? '',
      code: p.code ?? null,
      unitPrice: p.unitPrice,
      manufacturer: p.manufacturer ?? null,
      sku: p.sku ?? null,
      qtyInStock: p.qtyInStock ?? null,
      zohoId: p.zohoId ?? null,
      updatedAt: new Date().toISOString(),
    };
  }

  upsert(p: Product) {
    return this.algolia.saveObject({
      indexName: this.names.products,
      body: this.toRecord(p),
    });
  }

  remove(id: string) {
    return this.algolia.deleteObject({
      indexName: this.names.products,
      objectID: String(id),
    });
  }

  search(query: string, page = 0, hitsPerPage = 20) {
    return this.algolia.searchSingleIndex({
      indexName: this.names.products,
      searchParams: { query, page, hitsPerPage },
    });
  }
}

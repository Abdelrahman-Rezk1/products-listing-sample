import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductsIndexer } from './products.indexer';
import { FieldsMappingModule } from 'src/fields-mapping/fields-mapping.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), FieldsMappingModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsIndexer],
  exports: [ProductsService],
})
export class ProductsModule {}

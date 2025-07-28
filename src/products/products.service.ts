import {
  Injectable,
  MethodNotAllowedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { DeleteResult, In, Repository, UpdateResult } from 'typeorm';
import { CreateProductDTO } from './dtos/create-product.dto';
import { UpdateProductDTO } from './dtos/update-product.dto';
import { IdDTO } from 'src/common/dto/id.dto';
import { PaginationDTO } from 'src/common/dto/pagination.dto';
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async create(payload: CreateProductDTO): Promise<Product> {
    const product = this.productsRepository.create(payload);
    return this.productsRepository.save(product);
  }

  async update(id: string, payload: UpdateProductDTO): Promise<UpdateResult> {
    return await this.productsRepository.update(id, payload);
  }

  async read(
    payload: PaginationDTO,
  ): Promise<{ products: Product[]; total: number }> {
    const { page = 1, limit = 10 } = payload;
    const [products, total] = await this.productsRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      products,
      total,
    };
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
    return await this.productsRepository.findOne({
      where: { id: payload.id },
    });
  }

  async delete(payload: IdDTO): Promise<DeleteResult> {
    const product = await this.productsRepository.findOne({
      where: { id: payload.id },
      relations: ['orders'],
    });

    if (product?.orders.length)
      throw new MethodNotAllowedException('This product is assigned to orders');
    return await this.productsRepository.delete(payload.id);
  }
}

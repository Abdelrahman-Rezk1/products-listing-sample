import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { Repository } from 'typeorm';
import { CreateOrderDTO } from './dto/create-order.dto';
import { ProductsService } from 'src/products/products.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private repository: Repository<Order>,

    private productsService: ProductsService,
  ) {}

  async create(payload: CreateOrderDTO) {
    const products = await this.productsService.readByIdList(
      payload.productsIds,
    );

    let totalPrice = 0;
    products.map((p) => {
      totalPrice += Number(p.price);
    });

    const order = this.repository.create({ products, total: totalPrice });

    return this.repository.save(order);
  }

  async read() {
    return this.repository.find({ relations: ['products'] });
  }
}

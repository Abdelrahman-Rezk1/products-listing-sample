import { Controller, Post, Body, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { OrderService } from './orders.service';
import { CreateOrderDTO } from './dto/create-order.dto';
import { Order } from './entities/order.entity';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Order' })
  @ApiBody({ type: CreateOrderDTO })
  @ApiCreatedResponse({
    description: 'Order created successfully.',
    type: Order,
  })
  async create(@Body() payload: CreateOrderDTO) {
    return this.service.create(payload);
  }

  @Get()
  @ApiOperation({ summary: 'Get a list of orders' })
  @ApiOkResponse({
    description: 'List of Orders.',
    type: Promise<Order[]>,
  })
  async read() {
    return this.service.read();
  }
}

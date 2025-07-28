import { Product } from 'src/products/entities/product.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  BaseEntity,
  ManyToMany,
  Column,
  JoinTable,
} from 'typeorm';

@Entity('orders')
export class Order extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToMany(() => Product, (product) => product.orders)
  @JoinTable()
  products: Product[];

  @Column({ type: 'decimal', nullable: false })
  total: number;
}

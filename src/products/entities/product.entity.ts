import { Order } from '../../orders/entities/order.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';

@Entity('products')
export class Product extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // CRM record id (string). Unique when present.
  @Index({ unique: true, where: `"zohoId" IS NOT NULL` })
  @Column({ type: 'varchar', length: 50, nullable: true })
  zohoId: string | null;

  @Column({ length: 255, nullable: false })
  name: string;

  @Column('text', { nullable: true, default: null })
  description?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  code?: string | null;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  manufacturer?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  sku?: string | null;

  @Column({ type: 'int', nullable: true })
  qtyInStock?: number | null;

  @ManyToMany(() => Order, (order) => order.products)
  @JoinTable()
  orders: Order[];
}

import {
  MappingDirection,
  MappingEntity,
  TransformMethod,
} from 'src/common/enums/field-mapping.enums';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
  BaseEntity,
} from 'typeorm';

@Entity({ name: 'field_mappings' })
@Index(['entity', 'version'])
@Unique('uq_field_mapping_version_scope', [
  'entity',
  'version',
  'direction',
  'source_path',
  'target_path',
])
export class FieldMapping extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: MappingEntity,
  })
  entity: MappingEntity;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'boolean', default: false })
  isRequired: boolean;

  @Column({ type: 'text' })
  source: string;

  @Column({ type: 'text' })
  target: string;

  @Column({
    type: 'enum',
    enum: TransformMethod,
    nullable: true,
    name: 'transform_method',
  })
  transformMethod: TransformMethod;

  @Column({ type: 'jsonb', nullable: true })
  defaultValue: Record<string, any> | null;

  @Column({
    type: 'enum',
    enum: MappingDirection,
  })
  direction: MappingDirection;
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldMapping } from './entities/fields-mapping.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FieldMapping])],
})
export class FieldMappingModule {}

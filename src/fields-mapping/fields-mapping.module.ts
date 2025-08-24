import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldMapping } from './entities/fields-mapping.entity';
import { FieldsMappingService } from './fields-mapping.service';

@Module({
  imports: [TypeOrmModule.forFeature([FieldMapping])],
  providers: [FieldsMappingService],
  exports: [FieldsMappingService],
})
export class FieldsMappingModule {}

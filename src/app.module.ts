import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { AuthModule } from './auth/auth.module';

import zohoConfig from './configs/zoho.config';
import dbConfig from './configs/database.config';
import { envValidationSchema } from './configs/vlidation-schema';
import { AlgoliaModule } from './algolia/alogolia.module';
import { FieldsMappingModule } from './fields-mapping/fields-mapping.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: ['.env'],
      load: [zohoConfig, dbConfig],
      validationSchema: envValidationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),

    TypeOrmModule.forRootAsync({
      inject: [dbConfig.KEY],
      useFactory: (cfg: ConfigType<typeof dbConfig>): TypeOrmModuleOptions => ({
        type: cfg.type,
        host: cfg.host,
        username: cfg.username,
        password: cfg.password,
        database: cfg.database,
        synchronize: cfg.synchronize,
        autoLoadEntities: true,
      }),
    }),
    AlgoliaModule,
    AuthModule,
    OrdersModule,
    ProductsModule,
    FieldsMappingModule,
  ],
})
export class AppModule {}

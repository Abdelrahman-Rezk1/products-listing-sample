import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import algoliaConfig from '../configs/algolia.config';
import type { ConfigType } from '@nestjs/config';
import { algoliasearch } from 'algoliasearch';

export const ALGOLIA_CLIENT = Symbol('ALGOLIA_CLIENT');
export type AlgoliaClient = ReturnType<typeof algoliasearch>;

@Global()
@Module({
  imports: [ConfigModule.forFeature(algoliaConfig)],
  providers: [
    {
      provide: ALGOLIA_CLIENT,
      inject: [algoliaConfig.KEY],
      useFactory: (cfg: ConfigType<typeof algoliaConfig>): AlgoliaClient => {
        return algoliasearch(cfg.appID, cfg.writeKey);
      },
    },
  ],
  exports: [ALGOLIA_CLIENT],
})
export class AlgoliaModule {}

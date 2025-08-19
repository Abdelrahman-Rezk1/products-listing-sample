import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import algoliaConfig from '../configs/algolia.config';
import type { ConfigType } from '@nestjs/config';
import { algoliasearch } from 'algoliasearch';

export const ALGOLIA_CLIENT = Symbol('ALGOLIA_CLIENT');
export type AlgoliaClient = ReturnType<typeof algoliasearch>;

export const ALGOLIA_INDEX_NAMES = Symbol('ALGOLIA_INDEX_NAMES');
export type IndexNames = { products: string };

function buildIndex(env: string, app: string, domain: string, version: string) {
  return `${env}_${app}_${domain}_${version}`;
}

@Global()
@Module({
  imports: [ConfigModule.forFeature(algoliaConfig)],
  providers: [
    {
      provide: ALGOLIA_CLIENT,
      inject: [algoliaConfig.KEY],
      useFactory: (cfg: ConfigType<typeof algoliaConfig>): AlgoliaClient =>
        algoliasearch(cfg.appID, cfg.writeKey), // write key server-side
    },
    {
      // Centralized, typed index names for all domains
      provide: ALGOLIA_INDEX_NAMES,
      inject: [algoliaConfig.KEY],
      useFactory: (cfg: ConfigType<typeof algoliaConfig>): IndexNames => {
        const env = process.env.NODE_ENV ?? 'dev';
        const app = cfg.appName ?? 'app';
        const products =
          process.env.ALGOLIA_PRODUCTS_INDEX ??
          buildIndex(
            env,
            app,
            'products',
            process.env.ALGOLIA_PRODUCTS_VERSION ?? 'v1',
          );

        return { products };
      },
    },
  ],
  exports: [ALGOLIA_CLIENT, ALGOLIA_INDEX_NAMES],
})
export class AlgoliaModule {}

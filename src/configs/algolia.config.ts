// src/configs/zoho.config.ts
import { registerAs } from '@nestjs/config';

export interface AlgoliaConfig {
  appID: string;
  appName: string;
  searchKey: string;
  writeKey: string;
}

export default registerAs(
  'algolia',
  (): AlgoliaConfig => ({
    appID: process.env.ALGOLIA_APP_ID!,
    appName: process.env.ALGOLIA_APP_NAME!,
    searchKey: process.env.ALGOLIA_SEARCH_KEY!,
    writeKey: process.env.ALGOLIA_WRITE_KEY!,
  }),
);

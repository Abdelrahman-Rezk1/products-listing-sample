// src/configs/zoho.config.ts
import { registerAs } from '@nestjs/config';

export interface ZohoConfig {
  accounts: string;
  clientID: string;
  secret: string;
  redirectURI: string;
  scopes: string;
}

export default registerAs(
  'zoho',
  (): ZohoConfig => ({
    // non-null because Joi validated
    accounts: process.env.ZOHOSA_ACCOUNTS!,
    clientID: process.env.ZOHO_CLIENT_ID!,
    secret: process.env.ZOHO_CLIENT_SECRET!,
    redirectURI: process.env.ZOHO_REDIRECT_URI!,
    scopes: process.env.ZOHO_SCOPES!,
  }),
);

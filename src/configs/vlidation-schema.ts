// src/configs/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Zoho
  ZOHOSA_ACCOUNTS: Joi.string().uri().required(),
  ZOHO_CLIENT_ID: Joi.string().min(1).required(),
  ZOHO_CLIENT_SECRET: Joi.string().min(1).required(),
  ZOHO_REDIRECT_URI: Joi.string().uri().required(),
  ZOHO_SCOPES: Joi.string().min(1).required(),

  // DB
  DB_TYPE: Joi.string().valid('postgres', 'mysql').required(),
  DB_HOST: Joi.string().min(1).required(),
  DB_USER: Joi.string().min(1).required(),
  DB_PASSWORD: Joi.string().min(1).required(),
  DB_DATABASE: Joi.string().min(1).required(),

  // Algolia
  ALGOLIA_APP_ID: Joi.string().required().trim().min(1),
  ALGOLIA_APP_NAME: Joi.string().required().trim().min(1),
  ALGOLIA_SEARCH_KEY: Joi.string().required().trim().min(1),
  ALGOLIA_WRITE_KEY: Joi.string().required().trim().min(1),
});

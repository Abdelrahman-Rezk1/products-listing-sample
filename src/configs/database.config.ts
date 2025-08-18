import { registerAs } from '@nestjs/config';

export interface DbConfig {
  type: string;
  host: string;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
}

export default registerAs(
  'db',
  (): DbConfig => ({
    // Non-null assertions are safe because Joi will validate at bootstrap
    type: process.env.DB_TYPE!,
    host: process.env.DB_HOST!,
    username: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_DATABASE!,
    synchronize: true,
  }),
);

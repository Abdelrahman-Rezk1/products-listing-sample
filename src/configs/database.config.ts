import { registerAs } from '@nestjs/config';

export interface DbConfig {
  type: 'postgres' | 'mysql';
  host: string;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
}

export default registerAs(
  'db',
  (): DbConfig => ({
    type: (process.env.DB_TYPE as DbConfig['type'])!,
    host: process.env.DB_HOST!,
    username: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_DATABASE!,
    synchronize: true,
  }),
);

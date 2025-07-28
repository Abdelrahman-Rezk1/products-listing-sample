import { OpenAPIObject } from '@nestjs/swagger';

export type ISwaggerConfig = Omit<OpenAPIObject, 'paths'>;

export default {
  openapi: '3.0.0',
  info: {
    title: 'Products Backend',
    description: 'Products Backend API documentations',
    version: '0.0.0',
  },
};

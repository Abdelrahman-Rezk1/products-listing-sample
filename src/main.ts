import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import swaggerConfig from './configs/swagger.config';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Global Pipes.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  const swaggerDocs = new DocumentBuilder()
    .setTitle(swaggerConfig.info.title)
    .setDescription(swaggerConfig.info.description || '')
    .setVersion(swaggerConfig.info.version)
    .build();

  const document = () => SwaggerModule.createDocument(app, swaggerDocs);
  SwaggerModule.setup('', app, document);
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();

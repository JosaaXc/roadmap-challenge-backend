import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Activate Pino as the primary structured logger FIRST so all subsequent
  // logs (including the connection logs from Redis/Postgres modules) are formatted.
  app.useLogger(app.get(PinoLogger));

  const configService = app.get(ConfigService);
  const appName  = configService.get<string>('app.name', 'CodeQuest API');
  const port     = configService.get<number>('app.port', 3000);
  const env      = configService.get<string>('app.env', 'development');

  // 1. Security: Helmet HTTP Headers
  app.use(helmet());

  // 2. Security: CORS
  app.enableCors({ origin: '*' });

  // 3. Global URI Versioning (/api/v1)
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // 4. Strict Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 5. OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle(appName)
    .setDescription(`${appName} - REST API Documentation`)
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);

  // Tagged startup banner — emitted after Pino is active so it is properly structured
  const logger = new Logger('APP');
  logger.log(`Server: ${appName}`);
  logger.log(`Environment: ${env.toUpperCase()} | Port: ${port}`);
  logger.log(`Swagger docs available at /api/docs`);
}
await bootstrap();

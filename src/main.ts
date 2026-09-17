import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Trust exactly one reverse-proxy hop (nginx / Cloud Run's front-end / any
  // single load balancer) so Express parses X-Forwarded-For into req.ip/req.ips
  // instead of reporting the proxy's own IP for every client.
  app.set('trust proxy', 1);

  // Activate Pino as the primary structured logger FIRST so all subsequent
  // logs (including the connection logs from Redis/Postgres modules) are formatted.
  app.useLogger(app.get(PinoLogger));

  const configService = app.get(ConfigService);
  const appName = configService.get<string>('app.name', 'CodeQuest API');
  const port = configService.get<number>('app.port', 3000);
  const env = configService.get<string>('app.env', 'development');

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
    // Applied to EVERY documented operation - avoids decorating each route
    // by hand with @ApiHeader(). A handful of infra endpoints (JWKS, health,
    // Discord OAuth redirects) are exempt at runtime via @SkipRequiredHeaders(),
    // so the doc will slightly over-declare them as "required" there too -
    // an acceptable trade-off for not having to repeat this everywhere.
    .addGlobalParameters(
      { name: 'x-device-id', in: 'header', required: true, schema: { type: 'string' } },
      { name: 'x-app-version', in: 'header', required: true, schema: { type: 'string' } },
      { name: 'x-device-os', in: 'header', required: true, schema: { type: 'string' } },
      { name: 'x-latitude', in: 'header', required: true, schema: { type: 'string' } },
      { name: 'x-longitude', in: 'header', required: true, schema: { type: 'string' } },
    )
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

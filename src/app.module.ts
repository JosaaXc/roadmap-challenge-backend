import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TracingMiddleware } from './common/middlewares/tracing.middleware.js';
import { RequiredHeadersMiddleware } from './common/middlewares/required-headers.middleware.js';
import { GlobalExceptionFilter } from './core/filters/global-exception.filter.js';
import { ResponseTransformInterceptor } from './core/interceptors/response-transform.interceptor.js';
import { validateEnv } from './core/config/env.config.js';
import { getLoggerConfig } from './core/logger/logger.config.js';

@Module({
  imports: [
    // 1. Strict Global Environment Configuration (Fail-fast using Zod)
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // 2. Dynamic Profile-based Logger Factory
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getLoggerConfig,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Global request tracing (Correlation ID & Trace ID for ALL routes)
    consumer
      .apply(TracingMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });

    // Strict security headers validation only for API v1 routes
    consumer
      .apply(RequiredHeadersMiddleware)
      .forRoutes({ path: 'v1/{*path}', method: RequestMethod.ALL });
  }
}

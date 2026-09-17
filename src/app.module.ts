import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { Redis } from 'ioredis';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TracingMiddleware } from './common/middlewares/tracing.middleware.js';
import { RequiredHeadersMiddleware } from './common/middlewares/required-headers.middleware.js';
import { GlobalExceptionFilter } from './core/filters/global-exception.filter.js';
import { ResponseTransformInterceptor } from './core/interceptors/response-transform.interceptor.js';
import { IdempotencyInterceptor } from './common/interceptors/index.js';
import { validateEnv } from './core/config/env.validation.js';
import { getLoggerConfig } from './core/logger/logger.config.js';
import { DatabaseModule } from './core/database/database.module.js';
import { CacheModule } from './core/cache/cache.module.js';
import { HealthModule } from './core/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { RbacModule } from './modules/rbac/rbac.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from './common/guards/permissions.guard.js';
import appConfig from './core/config/app.config.js';

@Module({
  imports: [
    // 1. Strict Global Environment Configuration (Fail-fast using Zod)
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [appConfig],
    }),

    // 2. Dynamic Profile-based Logger Factory
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getLoggerConfig,
    }),

    // 3. Global Rate Limiting backed by Redis
    //    Key format in Redis: THROTTLER-{ttl}:{clientIp}:{endpointHash}
    //    Tracking is per client IP address (configurable via THROTTLE_TTL & THROTTLE_LIMIT)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('THROTTLE_TTL', 60_000),
            limit: configService.get<number>('THROTTLE_LIMIT', 60),
          },
        ],
        storage: new ThrottlerStorageRedisService(
          new Redis(configService.get<string>('REDIS_URL', 'redis://localhost:6379')),
        ),
      }),
    }),

    // 4. Infrastructure Modules
    DatabaseModule,
    CacheModule,
    HealthModule,

    // 5. Identity & Access Management (JWT RS256, JWKS, RBAC)
    AuthModule,
    RbacModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
    // Inner to ResponseTransformInterceptor: a cached replay's raw body still
    // flows up through the envelope wrapper, same as a normal fresh response.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Zero Trust: every request must carry a valid access token unless @IsPublic().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Dynamic RBAC: evaluated right after authentication, per-route via @RequirePermissions().
    { provide: APP_GUARD, useClass: PermissionsGuard },
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
      .exclude(
        { path: 'v1/.well-known/{*path}', method: RequestMethod.ALL },
        { path: 'v1/health', method: RequestMethod.ALL },
      )
      .forRoutes({ path: 'v1/{*path}', method: RequestMethod.ALL });
  }
}

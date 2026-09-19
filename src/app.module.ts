import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TracingMiddleware } from './common/middlewares/tracing.middleware.js';
import { GlobalExceptionFilter } from './core/filters/global-exception.filter.js';
import { ResponseTransformInterceptor } from './core/interceptors/response-transform.interceptor.js';
import { IdempotencyInterceptor } from './common/interceptors/index.js';
import { validateEnv } from './core/config/env.validation.js';
import { getLoggerConfig } from './core/logger/logger.config.js';
import { DatabaseModule } from './core/database/database.module.js';
import { CacheModule } from './core/cache/cache.module.js';
import { ThrottlerStorageRedisService } from './core/cache/throttler-storage-redis.service.js';
import { HealthModule } from './core/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { RbacModule } from './modules/rbac/rbac.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { QuestionsModule } from './modules/questions/questions.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from './common/guards/permissions.guard.js';
import { RequiredHeadersGuard } from './common/guards/required-headers.guard.js';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard.js';
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
    //    Key format in Redis: throttle:<generated-key> (see ThrottlerStorageRedisService)
    //    Tracking is per client IP address (configurable via THROTTLE_TTL, THROTTLE_LIMIT
    //    & THROTTLE_BLOCK_DURATION - the last one controls how long a client must wait
    //    after being rate-limited before it can send requests again).
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService, ThrottlerStorageRedisService],
      useFactory: (configService: ConfigService, storage: ThrottlerStorageRedisService) => {
        const ttl = configService.get<number>('THROTTLE_TTL', 60_000);
        return {
          throttlers: [
            {
              ttl,
              limit: configService.get<number>('THROTTLE_LIMIT', 60),
              // Falls back to the window length itself when unset, same as
              // @nestjs/throttler's own default (blockDuration || ttl).
              blockDuration: configService.get<number>('THROTTLE_BLOCK_DURATION') ?? ttl,
            },
          ],
          storage,
        };
      },
    }),

    // 4. Infrastructure Modules
    DatabaseModule,
    CacheModule,
    HealthModule,

    // 5. Identity & Access Management (JWT RS256, JWKS, RBAC)
    AuthModule,
    RbacModule,
    UsersModule,
    CatalogModule,
    QuestionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
    // Inner to ResponseTransformInterceptor: a cached replay's raw body still
    // flows up through the envelope wrapper, same as a normal fresh response.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    // Behind a single reverse proxy (nginx, Cloud Run's LB, etc.) - see main.ts's `trust proxy`.
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
    // Perimeter: mobile-app context headers. Opt out per-route with @SkipRequiredHeaders().
    { provide: APP_GUARD, useClass: RequiredHeadersGuard },
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
  }
}

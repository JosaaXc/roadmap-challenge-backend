import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service.js';
import { ThrottlerStorageRedisService } from './throttler-storage-redis.service.js';

@Global()
@Module({
  providers: [RedisService, ThrottlerStorageRedisService],
  exports: [RedisService, ThrottlerStorageRedisService],
})
export class CacheModule {}

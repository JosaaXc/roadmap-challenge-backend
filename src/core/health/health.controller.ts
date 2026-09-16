import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service.js';
import { RedisService } from '../cache/redis.service.js';
import { IsPublic } from '../../common/decorators/is-public.decorator.js';

@ApiTags('Health')
@SkipThrottle()
@IsPublic()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) { }

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'System Health Check' })
  @ApiResponse({ status: 200, description: 'All health checks passed' })
  @ApiResponse({ status: 503, description: 'One or more health checks failed' })
  async check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.prismaHealth.pingCheck('postgres', this.prisma),
      async (): Promise<HealthIndicatorResult> => {
        try {
          const client = this.redisService.getClient();
          const response = await client.ping();
          const isHealthy = response === 'PONG';
          return {
            redis: {
              status: isHealthy ? 'up' : 'down',
            },
          };
        } catch (error: any) {
          return {
            redis: {
              status: 'down',
              message: error?.message || 'Redis ping failed',
            },
          };
        }
      },
    ]);
  }
}

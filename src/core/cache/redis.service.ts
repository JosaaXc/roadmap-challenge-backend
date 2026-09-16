import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      throw new Error('REDIS_URL is not defined in environment variables.');
    }

    this.logger.log('Initializing Redis client connection...');
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`, err.stack);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client successfully connected.');
    });
  }

  async get<T = string>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;

    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<'OK'> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);

    if (ttlSeconds && ttlSeconds > 0) {
      return this.client.set(key, serialized, 'EX', ttlSeconds);
    }

    return this.client.set(key, serialized);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async onModuleDestroy() {
    this.logger.log('Closing Redis connection...');
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed.');
    }
  }
}

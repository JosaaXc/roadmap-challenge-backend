import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { transactionContext } from './transaction.context.js';
import { buildSoftDeleteExtension } from './soft-delete.extension.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('POSTGRES');

  constructor(configService: ConfigService) {
    const isDev = configService.get<string>('NODE_ENV') === 'development';

    super({
      log: isDev
        ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'info' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ]
        : [{ emit: 'stdout', level: 'error' }],
    });

    if (isDev) {
      (this as any).$on('query', (e: { query: string; params: string; duration: number }) => {
        this.logger.debug(`Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
      });
    }
  }

  async onModuleInit() {
    const extended = this.$extends(buildSoftDeleteExtension(this));
    for (const key of Reflect.ownKeys(extended)) {
      if (typeof key !== 'string' || key.startsWith('$')) continue;
      try {
        (this as unknown as Record<string, unknown>)[key] =
          (extended as unknown as Record<string, unknown>)[key];
      } catch {
        // Getter-only/exotic props are skipped — never model delegates.
      }
    }
    const extendedClient = extended as unknown as Record<string, unknown>;
    (this as unknown as Record<string, unknown>).$hardDelete =
      (extendedClient.$hardDelete as (...a: never[]) => unknown).bind(extended);
    const rawTransaction = extended.$transaction.bind(extended) as (...args: never[]) => unknown;
    (this as unknown as { $transaction: unknown }).$transaction = (...args: never[]) => {
      const [first, ...rest] = args;
      if (typeof first === 'function') {
        const cb = first as (txClient: Prisma.TransactionClient) => unknown;
        return rawTransaction(((txClient: Prisma.TransactionClient) =>
          transactionContext.run(txClient, () => cb(txClient))) as never, ...(rest as never[]));
      }
      return rawTransaction(...(args as never[]));
    };

    this.logger.log('Connecting to PostgreSQL via Prisma...');
    await this.$connect();
    this.logger.log('Connection established successfully.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Connection closed gracefully.');
  }

  /**
   * Transaction-aware client: inside a @Transactional() method (or any nested
   * call it makes), returns the active transaction client so writes join the
   * same DB transaction.
   */
  get tx(): Prisma.TransactionClient {
    return transactionContext.getStore() ?? this;
  }
}

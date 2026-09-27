import { Transactional } from './transactional.decorator.js';
import { transactionContext } from './transaction.context.js';

describe('@Transactional()', () => {
  it('opens a transaction via prisma.$transaction and runs the method inside it', async () => {
    const fakeTxClient = { marker: 'tx-client' };
    const $transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(fakeTxClient));

    class Service {
      constructor(public prisma: { $transaction: typeof $transaction }) {}

      @Transactional()
      async doWork() {
        return transactionContext.getStore();
      }
    }

    const service = new Service({ $transaction });
    const result = await service.doWork();

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(result).toBe(fakeTxClient);
  });

  it('reuses the active transaction for a nested @Transactional() call (propagation REQUIRED)', async () => {
    const fakeTxClient = { marker: 'tx-client' };
    const $transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(fakeTxClient));

    class Service {
      constructor(public prisma: { $transaction: typeof $transaction }) {}

      @Transactional()
      async outer() {
        return this.inner();
      }

      @Transactional()
      async inner() {
        return transactionContext.getStore();
      }
    }

    const service = new Service({ $transaction });
    const result = await service.outer();

    // Only ONE prisma.$transaction call for the whole outer+inner chain.
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(result).toBe(fakeTxClient);
  });

  it('propagates the error (letting Prisma roll back) when the method throws', async () => {
    const $transaction = vi.fn((cb: (tx: unknown) => unknown) => cb({}));

    class Service {
      constructor(public prisma: { $transaction: typeof $transaction }) {}

      @Transactional()
      async doWork(): Promise<never> {
        throw new Error('boom');
      }
    }

    const service = new Service({ $transaction });

    await expect(service.doWork()).rejects.toThrow('boom');
  });

  it('throws a clear error when the class has no `prisma` property', async () => {
    class Service {
      @Transactional()
      async doWork() {
        return 'unreachable';
      }
    }

    const service = new Service();

    await expect(service.doWork()).rejects.toThrow(/requires a 'prisma: PrismaService' property/);
  });
});

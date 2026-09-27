import { transactionContext } from './transaction.context.js';
import type { PrismaService } from './prisma.service.js';

/**
 * Method decorator that runs the whole method inside a single Prisma
 * transaction - COMMIT on success, automatic ROLLBACK if it throws.
 *
 */
export function Transactional(): MethodDecorator {
  return function (_target, propertyKey, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: { prisma: PrismaService }, ...args: unknown[]) {
      const prisma = this.prisma;
      if (!prisma) {
        throw new Error(
          `[Transactional] ${String(propertyKey)} requires a 'prisma: PrismaService' property on its class.`,
        );
      }

      // Already inside a transaction (nested @Transactional() call) - reuse it (propagation REQUIRED).
      if (transactionContext.getStore()) {
        return originalMethod.apply(this, args);
      }

      return prisma.$transaction((txClient) =>
        transactionContext.run(txClient, () => originalMethod.apply(this, args)),
      );
    };

    return descriptor;
  };
}

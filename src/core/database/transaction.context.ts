import { AsyncLocalStorage } from 'async_hooks';
import type { Prisma } from '@prisma/client';

/**
 * Holds the active Prisma transaction client for the current async
 * execution context (set by @Transactional()). PrismaService.tx reads from
 * this to transparently route queries into the ongoing transaction without
 * threading a `tx` param through every service method by hand.
 */
export const transactionContext = new AsyncLocalStorage<Prisma.TransactionClient>();

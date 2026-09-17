import type { CursorOrder, CursorPaginationDto } from './cursor-pagination.dto.js';
import type { PaginatedResult } from './paginated-result.interface.js';

export interface CursorFindManyDelegate<T, TArgs> {
  findMany(args: TArgs): Promise<T[]>;
}

export type CursorBaseArgs<TArgs> = Omit<TArgs, 'take' | 'skip' | 'cursor' | 'orderBy'>;

/**
 * High-performance cursor pagination for any Prisma delegate.
 *
 * Avoids LIMIT/OFFSET (which degrades on large tables) by requesting
 * `take + 1` rows ordered by `cursorField`, using the last returned row's
 * id as an opaque, index-friendly cursor for the next page.
 */
export async function paginateWithCursor<T, TArgs extends Record<string, unknown>>(
  delegate: CursorFindManyDelegate<T, TArgs>,
  baseArgs: CursorBaseArgs<TArgs>,
  dto: CursorPaginationDto,
  cursorField: string = 'id',
): Promise<PaginatedResult<T>> {
  const take = dto.take ?? 10;
  const order: CursorOrder = dto.order ?? 'desc';

  const queryArgs = {
    ...baseArgs,
    take: take + 1,
    orderBy: { [cursorField]: order },
  } as unknown as TArgs;

  if (dto.cursor) {
    (queryArgs as Record<string, unknown>).cursor = { [cursorField]: dto.cursor };
    (queryArgs as Record<string, unknown>).skip = 1;
  }

  const results = await delegate.findMany(queryArgs);

  let hasNextPage = false;
  let nextCursor: string | null = null;

  if (results.length > take) {
    hasNextPage = true;
    const nextItem = results.pop() as T;
    nextCursor = String((nextItem as Record<string, unknown>)[cursorField]);
  }

  return {
    items: results,
    meta: { nextCursor, hasNextPage, take },
  };
}

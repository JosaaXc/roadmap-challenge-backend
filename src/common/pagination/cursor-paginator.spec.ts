import { paginateWithCursor } from './cursor-paginator.js';

interface FakeRow {
  id: string;
  name: string;
}

function makeRows(count: number): FakeRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `id-${String(i).padStart(3, '0')}`,
    name: `row-${i}`,
  }));
}

describe('paginateWithCursor', () => {
  it('requests take + 1 rows under the hood', async () => {
    const findMany = vi.fn().mockResolvedValue(makeRows(3));

    await paginateWithCursor({ findMany }, { where: {} }, { take: 3, order: 'desc' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 4, orderBy: { id: 'desc' } }),
    );
  });

  it('reports hasNextPage=false and no cursor when there is no extra row', async () => {
    const findMany = vi.fn().mockResolvedValue(makeRows(2));

    const result = await paginateWithCursor({ findMany }, {}, { take: 5 });

    expect(result.items).toHaveLength(2);
    expect(result.meta).toEqual({ nextCursor: null, hasNextPage: false, take: 5 });
  });

  it('reports hasNextPage=true, trims the extra row, and sets nextCursor to its id', async () => {
    const findMany = vi.fn().mockResolvedValue(makeRows(6)); // take=5 + 1 extra

    const result = await paginateWithCursor<FakeRow, Record<string, unknown>>(
      { findMany },
      {},
      { take: 5 },
    );

    expect(result.items).toHaveLength(5);
    expect(result.items.map((r) => r.id)).toEqual([
      'id-000',
      'id-001',
      'id-002',
      'id-003',
      'id-004',
    ]);
    expect(result.meta).toEqual({ nextCursor: 'id-005', hasNextPage: true, take: 5 });
  });

  it('forwards the cursor and skip=1 when a cursor is provided', async () => {
    const findMany = vi.fn().mockResolvedValue(makeRows(1));

    await paginateWithCursor({ findMany }, {}, { take: 10, cursor: 'id-042' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'id-042' }, skip: 1 }),
    );
  });

  it('supports a custom cursor field', async () => {
    const rows = [
      { uuid: 'a', name: 'x' },
      { uuid: 'b', name: 'y' },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);

    const result = await paginateWithCursor({ findMany }, {}, { take: 1 }, 'uuid');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { uuid: 'desc' } }));
    expect(result.meta).toEqual({ nextCursor: 'b', hasNextPage: true, take: 1 });
  });

  it('defaults take to 10 when the dto omits it', async () => {
    const findMany = vi.fn().mockResolvedValue(makeRows(3));

    await paginateWithCursor({ findMany }, {}, {});

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 11 }));
  });
});

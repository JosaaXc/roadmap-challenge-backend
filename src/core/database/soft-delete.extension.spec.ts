import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { isSoftDeletable, prismaNotFoundError, withAliveFilter } from './soft-delete.extension.js';

describe('soft-delete extension helpers', () => {
  it('constrains reads to alive rows when where is absent', () => {
    expect(withAliveFilter(undefined)).toEqual({ deletedAt: null });
  });

  it('preserves existing conditions while adding the alive filter', () => {
    expect(withAliveFilter({ slug: 'x' })).toEqual({ slug: 'x', deletedAt: null });
  });

  it('respects an explicit caller-provided deletedAt filter', () => {
    const where = { deletedAt: { not: null } };
    expect(withAliveFilter(where)).toBe(where);
  });

  it('covers exactly the models carrying deletedAt', () => {
    for (const model of ['User', 'Course', 'LearningPath', 'PathNode', 'PathEdge']) {
      expect(isSoftDeletable(model)).toBe(true);
    }
    expect(isSoftDeletable('Question')).toBe(false);
    expect(isSoftDeletable('Role')).toBe(false);
  });

  it('builds a native P2025 error (mapped to 404 by GlobalExceptionFilter)', () => {
    const err = prismaNotFoundError();
    expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(err.code).toBe('P2025');
  });
});

import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { isSoftDeletable, prismaNotFoundError, withAliveFilter, withRelationFilters } from './soft-delete.extension.js';

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

  it('filters soft-deleted rows inside nested includes', () => {
    const args = withRelationFilters({
      where: { id: 'p1' },
      include: { nodes: true, edges: { where: { isOptional: false } } },
    }) as { include: { nodes: unknown; edges: { where: unknown } } };
    expect(args.include.nodes).toEqual({ where: { deletedAt: null } });
    expect(args.include.edges).toEqual({ where: { isOptional: false, deletedAt: null } });
  });

  it('leaves non-soft-deletable relations and explicit filters untouched', () => {
    const args = withRelationFilters({
      include: {
        // Question has no deletedAt
        question: { include: { options: true } },
        nodes: { where: { deletedAt: { not: null } } },
        // To-one relations reject `where` at the engine level — never inject
        user: { select: { username: true } },
      },
    }) as { include: { question: unknown; nodes: unknown; user: unknown } };
    expect(args.include.question).toEqual({ include: { options: true } });
    expect(args.include.nodes).toEqual({ where: { deletedAt: { not: null } } });
    expect(args.include.user).toEqual({ select: { username: true } });
  });
});

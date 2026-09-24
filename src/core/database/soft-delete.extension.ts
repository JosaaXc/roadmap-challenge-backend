import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';
import type { PrismaService } from './prisma.service.js';
import { transactionContext } from './transaction.context.js';

/**
 * Global soft-delete policy.
 */

export const SOFT_DELETE_MODELS: ReadonlySet<string> = new Set([
  'User',
  'Course',
  'LearningPath',
  'PathNode',
  'PathEdge',
]);

export function isSoftDeletable(model: string): boolean {
  return SOFT_DELETE_MODELS.has(model);
}

type Where = Record<string, unknown>;

export function withAliveFilter(where: Where | undefined | null): Where {
  if (where && typeof where === 'object' && 'deletedAt' in where) return where;
  return { ...where, deletedAt: null };
}

export function prismaNotFoundError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'An operation failed because it depends on one or more records that were required but not found.',
    { code: 'P2025', clientVersion: Prisma.prismaVersion.client },
  );
}

const bypassStore = new AsyncLocalStorage<boolean>();
const isBypassed = (): boolean => bypassStore.getStore() === true;
function runBypassed<T>(fn: () => Promise<T>): Promise<T> {
  if (isBypassed()) return fn();
  return bypassStore.run(true, fn);
}

type Any = any;
interface HookParams {
  model: string;
  args: Any;
  query: (args: Any) => Any;
}

interface ModelDelegate {
  findFirst(args?: Any): Any;
  findFirstOrThrow(args?: Any): Any;
  update(args: Any): Any;
  create(args: Any): Any;
  deleteMany(args: Any): Any;
}

/** Relation field -> target model, to filter soft-deleted rows in nested includes. */
const RELATION_MODEL: Record<string, string> = {
  user: 'User',
  role: 'Role',
  accounts: 'UserAccount',
  refreshTokens: 'RefreshToken',
  learningPaths: 'LearningPath',
  submissions: 'QuestionnaireSubmission',
  submission: 'QuestionnaireSubmission',
  answers: 'Answer',
  generatedPath: 'LearningPath',
  nodes: 'PathNode',
  edges: 'PathEdge',
  path: 'LearningPath',
  course: 'Course',
  outgoingEdges: 'PathEdge',
  incomingEdges: 'PathEdge',
  sourceNode: 'PathNode',
  targetNode: 'PathNode',
  question: 'Question',
  option: 'QuestionOption',
  options: 'QuestionOption',
  permissions: 'RolePermission',
  roles: 'RolePermission',
  permission: 'Permission',
};

export function withRelationFilters<T>(args: T): T {
  if (!args || typeof args !== 'object') return args;
  const root = args as Record<string, unknown>;
  for (const container of ['include', 'select'] as const) {
    const block = root[container];
    if (block && typeof block === 'object') {
      applyToBlock(block as Record<string, unknown>);
    }
  }
  return args;
}

const TO_MANY_RELATIONS: ReadonlySet<string> = new Set([
  'accounts',
  'refreshTokens',
  'learningPaths',
  'submissions',
  'answers',
  'nodes',
  'edges',
  'options',
  'outgoingEdges',
  'incomingEdges',
  'permissions',
  'roles',
]);

function applyToBlock(block: Record<string, unknown>): void {
  for (const [field, selection] of Object.entries(block)) {
    const target = RELATION_MODEL[field];
    if (!target) continue;
    const many = TO_MANY_RELATIONS.has(field) && isSoftDeletable(target);
    if (selection === true) {
      if (many) {
        block[field] = { where: { deletedAt: null } };
      }
      continue;
    }
    if (!selection || typeof selection !== 'object') continue;
    const nested = selection as Record<string, unknown>;
    if (many) {
      nested.where = withAliveFilter(nested.where as Where | undefined);
    }
    for (const container of ['include', 'select'] as const) {
      const inner = nested[container];
      if (inner && typeof inner === 'object') {
        applyToBlock(inner as Record<string, unknown>);
      }
    }
  }
}

/** Keeps select/include/omit while rebuilding args for a rewritten operation. */
function resultArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ['select', 'include', 'omit'] as const) {
    if (args[key] !== undefined) out[key] = args[key];
  }
  return out;
}

export function buildSoftDeleteExtension(rawClient: unknown) {
  const delegateOf = (model: string): ModelDelegate => {
    const active = (transactionContext.getStore() ?? rawClient) as Record<string, ModelDelegate>;
    return active[model];
  };

  return {
    name: 'softDelete',
    query: {
      $allModels: {
        findMany({ model, args, query }: HookParams) {
          if (isBypassed() || !isSoftDeletable(model)) return query(args);
          const a = (args ?? {}) as { where?: Where } & Record<string, unknown>;
          return query(withRelationFilters({ ...a, where: withAliveFilter(a.where) }));
        },

        findFirst({ model, args, query }: HookParams) {
          if (isBypassed() || !isSoftDeletable(model)) return query(args);
          const a = (args ?? {}) as { where?: Where } & Record<string, unknown>;
          return query(withRelationFilters({ ...a, where: withAliveFilter(a.where) }));
        },

        findFirstOrThrow({ model, args, query }: HookParams) {
          if (isBypassed() || !isSoftDeletable(model)) return query(args);
          const a = (args ?? {}) as { where?: Where } & Record<string, unknown>;
          return query(withRelationFilters({ ...a, where: withAliveFilter(a.where) }));
        },

        findUnique({ model, args, query }: HookParams) {
          if (isBypassed() || !isSoftDeletable(model)) return query(args);
          const { where, ...rest } = (args ?? {}) as { where?: Where } & Record<string, unknown>;
          return runBypassed(() => delegateOf(model).findFirst(withRelationFilters({ ...rest, where: withAliveFilter(where) })));
        },

        findUniqueOrThrow({ model, args, query }: HookParams) {
          if (isBypassed() || !isSoftDeletable(model)) return query(args);
          const { where, ...rest } = (args ?? {}) as { where?: Where } & Record<string, unknown>;
          return runBypassed(() => delegateOf(model).findFirstOrThrow(withRelationFilters({ ...rest, where: withAliveFilter(where) })));
        },

        count({ model, args, query }: HookParams) {
          if (isBypassed() || !isSoftDeletable(model)) return query(args);
          const a = (args ?? {}) as { where?: Where } & Record<string, unknown>;
          return query(withRelationFilters({ ...a, where: withAliveFilter(a.where) }));
        },

        updateMany({ model, args, query }: HookParams) {
          if (isBypassed() || !isSoftDeletable(model)) return query(args);
          const a = (args ?? {}) as { where?: Where } & Record<string, unknown>;
          return query(withRelationFilters({ ...a, where: withAliveFilter(a.where) }));
        },

        update({ model, args, query }: HookParams) {
          if (isBypassed() || !isSoftDeletable(model)) return query(args);
          const a = (args ?? {}) as { where?: Where } & Record<string, unknown>;
          return runBypassed(async () => {
            const existing = await delegateOf(model).findFirst({
              where: withAliveFilter(a.where),
              select: { id: true },
            });
            if (!existing) throw prismaNotFoundError();
            return delegateOf(model).update(withRelationFilters(args));
          });
        },

        // Singular `delete` becomes a soft-delete; shape of the return value
        // (the record) is preserved. Second delete on the same row → P2025.
        delete({ model, args, query }: HookParams) {
          if (isBypassed() || !isSoftDeletable(model)) return query(args);
          const a = (args ?? {}) as { where?: Where } & Record<string, unknown>;
          return runBypassed(async () => {
            const existing = await delegateOf(model).findFirst({
              where: withAliveFilter(a.where),
              select: { id: true },
            });
            if (!existing) throw prismaNotFoundError();
            const { where, ...rest } = a;
            return delegateOf(model).update(
              withRelationFilters({
                ...resultArgs(rest),
                where,
                data: { deletedAt: new Date() },
              }),
            );
          });
        },

        // `upsert` also requires a unique selector (same engine restriction as
        // findUnique/update). Required: the seeder upserts User/Course rows.
        // Liveness decides the branch; both run raw to avoid re-entering hooks.
        upsert({ model, args, query }: HookParams) {
          if (isBypassed() || !isSoftDeletable(model)) return query(args);
          const a = (args ?? {}) as { where?: Where; create?: unknown; update?: unknown } & Record<string, unknown>;
          return runBypassed(async () => {
            const existing = await delegateOf(model).findFirst({
              where: withAliveFilter(a.where),
              select: { id: true },
            });
            if (existing) {
              return delegateOf(model).update(withRelationFilters({ ...resultArgs(a), where: a.where, data: a.update }));
            }
            return delegateOf(model).create(withRelationFilters({ ...resultArgs(a), data: a.create }));
          });
        },
      },
    },
    client: {
      $hardDelete(model: string, where: Where) {
        return runBypassed(() => delegateOf(model).deleteMany({ where }));
      },
    },
  };
}

/** Extended-client surface for call sites needing physical removal. */
export interface ExtendedClient {
  $hardDelete(model: string, where: Record<string, unknown>): Promise<{ count: number }>;
}

export function asExtended(prisma: PrismaService): PrismaService & ExtendedClient {
  return prisma as PrismaService & ExtendedClient;
}

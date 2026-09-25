import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Course, NodeType, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service.js';
import { RedisService } from '../../core/cache/redis.service.js';
import { Transactional } from '../../core/database/transactional.decorator.js';
import { AppException } from '../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../common/exceptions/error-codes.enum.js';
import {
  CursorFindManyDelegate,
  PaginatedResult,
  paginateWithCursor,
} from '../../common/pagination/index.js';
import type { GeneratePathDto } from './dto/generate-path.dto.js';
import type { PathQueryDto } from './dto/path-query.dto.js';
import type { CreateCustomNodeDto } from './dto/create-custom-node.dto.js';

export type PathWithGraph = Prisma.LearningPathGetPayload<{
  include: { nodes: { include: { course: { select: { imageUrl: true; url: true } } } }; edges: true };
}>;

export type PathWithNextStep = PathWithGraph & { nextStep: string | null };

const NODES_ORDERED = Prisma.validator<Prisma.LearningPathInclude>()({
  nodes: { orderBy: { position: 'asc' }, include: { course: { select: { imageUrl: true, url: true } } } },
  edges: true,
});

function withNextStep<T extends PathWithGraph>(path: T): T & { nextStep: string | null } {
  const next = path.nodes.find((node) => !node.isCompleted) ?? null;
  return { ...path, nextStep: next?.title ?? null };
}

const BLUEPRINT_TTL_SECONDS = 86_400; // 24h
const MAX_PATH_COURSES = 6;

const LEVEL_WEIGHT: Record<string, number> = {
  BEGINNER: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
};

function blueprintKey(optionIds: string[]): string {
  const hash = createHash('sha256').update([...optionIds].sort().join(',')).digest('hex');
  return `path_blueprint:${hash}`;
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

function relevance(course: Course, wanted: ReadonlySet<string>): number {
  let score = 0;
  for (const tag of course.tags) {
    if (wanted.has(tag.trim().toLowerCase())) score += 1;
  }
  return score;
}

function titleFromTags(tags: string[]): string {
  const top = tags.slice(0, 3).map((t) => t.charAt(0).toUpperCase() + t.slice(1));
  return `Ruta Personalizada: ${top.join(' & ')}`;
}

@Injectable()
export class PathsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  @Transactional()
  async generateDynamicPath(userId: string, dto: GeneratePathDto) {
    const tx = this.prisma.tx;
    const validated = await this.validateAnswers(tx, dto);

    const optionIds = validated.map((v) => v.option.id);
    const consolidatedTags = normalizeTags(validated.flatMap((v) => v.option.tagsOutput));

    const courseIds = await this.resolveBlueprint(optionIds, consolidatedTags);
    const courses = await this.loadCoursesInOrder(tx, courseIds);
    if (courses.length === 0) {
      throw new AppException(
        ErrorCodes.INVALID_QUESTION_OPTION,
        'The selected answers do not match any active course in the catalog.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const submission = await tx.questionnaireSubmission.create({ data: { userId } });
    await tx.answer.createMany({
      data: validated.map((v) => ({
        submissionId: submission.id,
        questionId: v.option.questionId,
        optionId: v.option.id,
        tagsSnapshot: v.option.tagsOutput,
      })),
    });

    const pathTitle = titleFromTags(consolidatedTags);
    const pathImageUrl = courses[0]?.imageUrl ?? null;

    const path = await tx.learningPath.create({
      data: {
        userId,
        title: pathTitle,
        description: `Generada a partir de ${validated.length} respuestas del cuestionario.`,
        imageUrl: pathImageUrl,
      },
    });

    const nodes = [];
    for (const [index, course] of courses.entries()) {
      nodes.push(
        await tx.pathNode.create({
          data: {
            pathId: path.id,
            type: NodeType.DEVTALLES_COURSE,
            title: course.title,
            courseId: course.id,
            isCompleted: false,
            position: index,
          },
        }),
      );
    }

    // Sequential chain; the final hop is optional (alternative finishing step).
    for (let i = 0; i + 1 < nodes.length; i += 1) {
      await tx.pathEdge.create({
        data: {
          pathId: path.id,
          sourceNodeId: nodes[i].id,
          targetNodeId: nodes[i + 1].id,
          isOptional: i === nodes.length - 2,
        },
      });
    }

    await tx.questionnaireSubmission.update({
      where: { id: submission.id },
      data: { generatedPathId: path.id },
    });

    return withNextStep(
      await tx.learningPath.findUniqueOrThrow({
        where: { id: path.id },
        include: { ...NODES_ORDERED },
      }),
    );
  }

  async findMyPaths(userId: string, dto: PathQueryDto): Promise<PaginatedResult<PathWithNextStep>> {
    const delegate: CursorFindManyDelegate<PathWithGraph, Prisma.LearningPathFindManyArgs> = {
      findMany: (args) => this.prisma.learningPath.findMany(args) as Promise<PathWithGraph[]>,
    };
    const page = await paginateWithCursor(
      delegate,
      {
        where: {
          userId,
          ...(dto.isFavorite !== undefined && { isFavorite: dto.isFavorite }),
          ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
        },
        include: { ...NODES_ORDERED },
      },
      dto,
    );
    return { ...page, items: page.items.map(withNextStep) };
  }

  async findPathById(callerUserId: string, pathId: string): Promise<PathWithGraph> {
    const path = await this.prisma.learningPath.findFirst({
      where: { id: pathId },
      include: { ...NODES_ORDERED },
    });
    if (!path || (path.userId !== callerUserId && !path.isPublic)) {
      throw new AppException(ErrorCodes.PATH_NOT_FOUND, `Learning path "${pathId}" was not found.`, HttpStatus.NOT_FOUND);
    }
    return path;
  }

  async findCommunityPaths(dto: PathQueryDto) {
    type CommunityRow = Prisma.LearningPathGetPayload<{
      include: {
        nodes: { select: { id: true } };
        user: { select: { username: true } };
      };
    }>;
    const delegate: CursorFindManyDelegate<CommunityRow, Prisma.LearningPathFindManyArgs> = {
      findMany: (args) => this.prisma.learningPath.findMany(args) as Promise<CommunityRow[]>,
    };
    const page = await paginateWithCursor(
      delegate,
      {
        where: { isPublic: true },
        include: {
          nodes: { select: { id: true } },
          user: { select: { username: true } },
        },
      },
      dto,
    );
    return {
      ...page,
      items: page.items.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        progress: row.progress,
        imageUrl: row.imageUrl,
        nodeCount: row.nodes.length,
        owner: { username: row.user.username },
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    };
  }

  async findAllPathsAdmin(dto: PathQueryDto) {
    type AdminRow = Prisma.LearningPathGetPayload<{
      include: {
        nodes: { select: { id: true } };
        user: { select: { username: true } };
      };
    }>;
    const delegate: CursorFindManyDelegate<AdminRow, Prisma.LearningPathFindManyArgs> = {
      findMany: (args) => this.prisma.learningPath.findMany(args) as Promise<AdminRow[]>,
    };
    const page = await paginateWithCursor(
      delegate,
      {
        include: {
          nodes: { select: { id: true } },
          user: { select: { username: true } },
        },
      },
      dto,
    );
    return {
      ...page,
      items: page.items.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        progress: row.progress,
        imageUrl: row.imageUrl,
        isPublic: row.isPublic,
        nodeCount: row.nodes.length,
        owner: { username: row.user.username },
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    };
  }

  @Transactional()
  async adminDeletePath(pathId: string) {
    const tx = this.prisma.tx;
    const path = await tx.learningPath.findUnique({ where: { id: pathId } });
    if (!path) {
      throw new AppException(
        ErrorCodes.PATH_NOT_FOUND,
        `Learning path "${pathId}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }
    await tx.learningPath.delete({ where: { id: pathId } });
  }

  private async validateAnswers(
    tx: Prisma.TransactionClient,
    dto: GeneratePathDto,
  ) {
    const seen = new Set<string>();
    for (const answer of dto.answers) {
      if (seen.has(answer.questionId)) {
        throw new AppException(
          ErrorCodes.INVALID_QUESTION_OPTION,
          `Question "${answer.questionId}" is answered more than once.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      seen.add(answer.questionId);
    }

    const optionIds = dto.answers.map((a) => a.optionId);
    const options = await tx.questionOption.findMany({
      where: { id: { in: optionIds } },
      include: { question: true },
    });
    const byId = new Map(options.map((o) => [o.id, o]));

    return dto.answers.map((answer) => {
      const option = byId.get(answer.optionId);
      if (!option || option.questionId !== answer.questionId || !option.question.isActive) {
        throw new AppException(
          ErrorCodes.INVALID_QUESTION_OPTION,
          `Option "${answer.optionId}" is not a valid active choice for question "${answer.questionId}".`,
          HttpStatus.BAD_REQUEST,
        );
      }
      return { answer, option };
    });
  }

  private async resolveBlueprint(optionIds: string[], consolidatedTags: string[]): Promise<string[]> {
    const key = blueprintKey(optionIds);
    const cached = await this.redis.get<string[]>(key);
    if (cached) return cached;

    // Cache miss: match active catalog courses against consolidated tags,
    // rank by tag overlap (foundations first, title as stable tiebreak).
    const wanted = new Set(consolidatedTags);
    const matches = await this.prisma.course.findMany({
      where: { isActive: true, tags: { hasSome: consolidatedTags } },
    });
    const ranked = matches
      .map((course) => ({ course, score: relevance(course, wanted) }))
      .filter((entry) => entry.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (LEVEL_WEIGHT[a.course.level] ?? 99) - (LEVEL_WEIGHT[b.course.level] ?? 99) ||
          a.course.title.localeCompare(b.course.title),
      )
      .slice(0, MAX_PATH_COURSES)
      .map((entry) => entry.course.id);

    await this.redis.set(key, ranked, BLUEPRINT_TTL_SECONDS);
    return ranked;
  }

  private async loadCoursesInOrder(tx: Prisma.TransactionClient, courseIds: string[]): Promise<Course[]> {
    if (courseIds.length === 0) return [];
    const courses = await tx.course.findMany({ where: { id: { in: courseIds }, isActive: true } });
    const position = new Map(courseIds.map((id, index) => [id, index]));
    // findMany returns no guaranteed order — restore blueprint ranking.
    // Blueprint ids may reference soft-deleted/inactive courses; drop those.
    return courses.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
  }

  @Transactional()
  async toggleNodeCompletion(userId: string, pathId: string, nodeId: string) {
    const tx = this.prisma.tx;
    await this.assertOwnership(tx, userId, pathId);

    const node = await tx.pathNode.findFirst({ where: { id: nodeId, pathId } });
    if (!node) {
      throw new AppException(
        ErrorCodes.RECORD_NOT_FOUND,
        `Node "${nodeId}" was not found in path "${pathId}".`,
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await tx.pathNode.update({
      where: { id: node.id },
      data: { isCompleted: !node.isCompleted },
    });
    const progress = await this.recalculateProgress(tx, pathId);
    return { node: updated, progress };
  }

  @Transactional()
  async toggleFavorite(userId: string, pathId: string) {
    const tx = this.prisma.tx;
    const path = await this.assertOwnership(tx, userId, pathId);

    const updated = await tx.learningPath.update({
      where: { id: path.id },
      data: { isFavorite: !path.isFavorite },
    });
    return { id: updated.id, isFavorite: updated.isFavorite };
  }

  @Transactional()
  async addCustomNode(userId: string, pathId: string, dto: CreateCustomNodeDto) {
    const tx = this.prisma.tx;
    await this.assertOwnership(tx, userId, pathId);

    if (dto.previousNodeId) {
      const previous = await tx.pathNode.findFirst({
        where: { id: dto.previousNodeId, pathId },
      });
      if (!previous) {
        throw new AppException(
          ErrorCodes.RECORD_NOT_FOUND,
          `Previous node "${dto.previousNodeId}" was not found in path "${pathId}".`,
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const node = await tx.pathNode.create({
      data: {
        pathId,
        type: NodeType.EXTERNAL_LINK,
        title: dto.title,
        externalUrl: dto.url,
        isCompleted: false,
        // Append at the end of the deterministic sequence.
        position: await tx.pathNode.count({ where: { pathId } }),
      },
    });

    if (dto.previousNodeId) {
      await tx.pathEdge.create({
        data: {
          pathId,
          sourceNodeId: dto.previousNodeId,
          targetNodeId: node.id,
          isOptional: true,
        },
      });
    }

    const progress = await this.recalculateProgress(tx, pathId);
    return { node, progress };
  }

  @Transactional()
  async toggleVisibility(userId: string, pathId: string) {
    const tx = this.prisma.tx;
    const path = await this.assertOwnership(tx, userId, pathId);

    const updated = await tx.learningPath.update({
      where: { id: path.id },
      data: { isPublic: !path.isPublic },
    });
    return { id: updated.id, isPublic: updated.isPublic };
  }

  @Transactional()
  async deletePath(userId: string, pathId: string): Promise<void> {
    const tx = this.prisma.tx;
    await this.assertOwnership(tx, userId, pathId);
    // Soft-delete via the Prisma extension (row retained, reads exclude it).
    await tx.learningPath.delete({ where: { id: pathId } });
  }

  @Transactional()
  async deleteCustomNode(userId: string, pathId: string, nodeId: string) {
    const tx = this.prisma.tx;
    await this.assertOwnership(tx, userId, pathId);

    // Single check covering: missing, foreign-path, and DevTalles base nodes.
    const node = await tx.pathNode.findFirst({
      where: { id: nodeId, pathId, type: NodeType.EXTERNAL_LINK },
    });
    if (!node) {
      throw new AppException(
        ErrorCodes.RECORD_NOT_FOUND,
        `Custom node "${nodeId}" was not found in path "${pathId}".`,
        HttpStatus.NOT_FOUND,
      );
    }

    await tx.pathEdge.deleteMany({
      where: { pathId, OR: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }] },
    });
    await tx.pathNode.delete({ where: { id: nodeId } });

    const progress = await this.recalculateProgress(tx, pathId);
    return { node, progress };
  }

  @Transactional()
  async forkPath(callerUserId: string, pathId: string) {
    const tx = this.prisma.tx;
    const source = await tx.learningPath.findFirst({
      where: { id: pathId },
      include: { ...NODES_ORDERED },
    });
    // Same 404 whether missing, private-and-foreign, or soft-deleted: never
    // leak the existence of another user's private path.
    if (!source || (source.userId !== callerUserId && !source.isPublic)) {
      throw new AppException(ErrorCodes.PATH_NOT_FOUND, `Learning path "${pathId}" was not found.`, HttpStatus.NOT_FOUND);
    }

    const clone = await tx.learningPath.create({
      data: {
        userId: callerUserId,
        title: `${source.title} (Fork)`,
        description: source.description,
        imageUrl: source.imageUrl,
        progress: 0,
        isFavorite: false,
        isPublic: false,
      },
    });

    const idMap = new Map<string, string>();
    for (const node of source.nodes) {
      const copy = await tx.pathNode.create({
        data: {
          pathId: clone.id,
          type: node.type,
          title: node.title,
          isCompleted: false,
          position: node.position,
          courseId: node.courseId,
          externalUrl: node.externalUrl,
        },
      });
      idMap.set(node.id, copy.id);
    }

    for (const edge of source.edges) {
      const sourceNodeId = idMap.get(edge.sourceNodeId);
      const targetNodeId = idMap.get(edge.targetNodeId);
      if (!sourceNodeId || !targetNodeId) continue;
      await tx.pathEdge.create({
        data: { pathId: clone.id, sourceNodeId, targetNodeId, isOptional: edge.isOptional },
      });
    }

    return withNextStep(
      await tx.learningPath.findUniqueOrThrow({
        where: { id: clone.id },
        include: { ...NODES_ORDERED },
      }),
    );
  }

  private async assertOwnership(tx: Prisma.TransactionClient, userId: string, pathId: string) {
    const path = await tx.learningPath.findFirst({ where: { id: pathId, userId } });
    if (!path) {
      throw new AppException(
        ErrorCodes.PATH_NOT_FOUND,
        `Learning path "${pathId}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }
    return path;
  }

  private async recalculateProgress(tx: Prisma.TransactionClient, pathId: string): Promise<number> {
    const [total, completed] = await Promise.all([
      tx.pathNode.count({ where: { pathId } }),
      tx.pathNode.count({ where: { pathId, isCompleted: true } }),
    ]);
    const progress = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
    await tx.learningPath.update({ where: { id: pathId }, data: { progress } });
    return progress;
  }
}

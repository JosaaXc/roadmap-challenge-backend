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
  include: { nodes: true; edges: true };
}>;

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

    const path = await tx.learningPath.create({
      data: {
        userId,
        title: titleFromTags(consolidatedTags),
        description: `Generada a partir de ${validated.length} respuestas del cuestionario.`,
      },
    });

    const nodes = [];
    for (const course of courses) {
      nodes.push(
        await tx.pathNode.create({
          data: {
            pathId: path.id,
            type: NodeType.DEVTALLES_COURSE,
            title: course.title,
            courseId: course.id,
            isCompleted: false,
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

    return tx.learningPath.findUniqueOrThrow({
      where: { id: path.id },
      include: { nodes: true, edges: true },
    });
  }

  findMyPaths(userId: string, dto: PathQueryDto): Promise<PaginatedResult<PathWithGraph>> {
    const delegate: CursorFindManyDelegate<PathWithGraph, Prisma.LearningPathFindManyArgs> = {
      findMany: (args) => this.prisma.learningPath.findMany(args) as Promise<PathWithGraph[]>,
    };
    return paginateWithCursor(delegate, { where: { userId }, include: { nodes: true, edges: true } }, dto);
  }

  async findPathById(userId: string, pathId: string) {
    const path = await this.prisma.learningPath.findFirst({
      where: { id: pathId, userId },
      include: { nodes: true, edges: true },
    });
    if (!path) {
      throw new AppException(ErrorCodes.PATH_NOT_FOUND, `Learning path "${pathId}" was not found.`, HttpStatus.NOT_FOUND);
    }
    return path;
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

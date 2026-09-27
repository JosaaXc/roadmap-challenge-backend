import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { RedisService } from '../../core/cache/redis.service.js';
import { catalogTagsCacheKey } from '../../common/cache/cache-keys.util.js';
import { AppException } from '../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../common/exceptions/error-codes.enum.js';
import { Transactional } from '../../core/database/transactional.decorator.js';
import type { QuestionResponseDto } from './dto/questionnaire-response.dto.js';
import type { ReorderQuestionsDto } from './dto/reorder-questions.dto.js';
import type {
  CreateQuestionDto,
  CreateQuestionOptionDto,
  UpdateQuestionDto,
  UpdateQuestionOptionDto,
} from './dto/create-question.dto.js';

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  async getActiveQuestionnaire(): Promise<QuestionResponseDto[]> {
    const questions = await this.prisma.question.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { options: true },
    });

    return questions.map(({ options, ...question }) => ({
      ...question,
      options: options.map(({ tagsOutput: _tagsOutput, ...option }) => option),
    }));
  }

  async findAllQuestionsAdmin() {
    return this.prisma.question.findMany({
      orderBy: { order: 'asc' },
      include: { options: true },
    });
  }

  private invalidateTagsCache(): Promise<number> {
    return this.redis.del(catalogTagsCacheKey());
  }

  @Transactional()
  async createQuestion(dto: CreateQuestionDto) {
    const tx = this.prisma.tx;
    const { options, ...questionData } = dto;

    const total = await tx.question.count();
    const order = Math.min(dto.order, total + 1);

    const collision = await tx.question.findFirst({
      where: { order, isActive: true },
      select: { id: true },
    });
    if (collision) {
      await tx.question.updateMany({
        where: { order: { gte: order } },
        data: { order: { increment: 1 } },
      });
    }

    const created = await tx.question.create({
      data: {
        ...questionData,
        order,
        options: {
          create: options.map((opt) => ({
            text: opt.text,
            tagsOutput: opt.tagsOutput,
          })),
        },
      },
      include: { options: true },
    });
    await this.invalidateTagsCache();
    return created;
  }

  @Transactional()
  async updateQuestion(id: string, dto: UpdateQuestionDto) {
    const tx = this.prisma.tx;
    const question = await tx.question.findUnique({ where: { id } });
    if (!question) {
      throw new AppException(
        ErrorCodes.RECORD_NOT_FOUND,
        `Question "${id}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }
    const { options: _options, ...updateData } = dto;

    if (updateData.order !== undefined && updateData.order !== question.order) {
      const total = await tx.question.count();
      const newOrder = Math.min(Math.max(1, updateData.order), total);
      if (newOrder > question.order) {
        await tx.question.updateMany({
          where: { id: { not: id }, order: { gt: question.order, lte: newOrder } },
          data: { order: { decrement: 1 } },
        });
      } else {
        await tx.question.updateMany({
          where: { id: { not: id }, order: { gte: newOrder, lt: question.order } },
          data: { order: { increment: 1 } },
        });
      }
      updateData.order = newOrder;
    }

    const updated = await tx.question.update({
      where: { id },
      data: updateData,
      include: { options: true },
    });
    await this.invalidateTagsCache();
    return updated;
  }

  @Transactional()
  async reorderQuestions(dto: ReorderQuestionsDto) {
    const tx = this.prisma.tx;
    const ids = dto.items.map((item) => item.id);

    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCodes.VALIDATION_ERROR,
        'Duplicate question ids in reorder payload.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const newOrders = dto.items.map((item) => item.newOrder);
    if (new Set(newOrders).size !== newOrders.length) {
      throw new AppException(
        ErrorCodes.VALIDATION_ERROR,
        'Duplicate newOrder values in reorder payload: each question must land on a distinct position.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await tx.question.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      const found = new Set(existing.map((q) => q.id));
      const missing = ids.find((id) => !found.has(id));
      throw new AppException(
        ErrorCodes.RECORD_NOT_FOUND,
        `Question "${missing}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Negation pattern: park every affected row on a negative order first,
    // so the subsequent writes to the final positions can never collide
    // transiently (e.g. swapping 1 <-> 2) even under a unique constraint.
    await tx.question.updateMany({
      where: { id: { in: ids } },
      data: { order: { multiply: -1 } },
    });
    for (const item of dto.items) {
      await tx.question.update({
        where: { id: item.id },
        data: { order: item.newOrder },
      });
    }

    const reordered = await tx.question.findMany({
      where: { id: { in: ids } },
      orderBy: { order: 'asc' },
      include: { options: true },
    });
    await this.invalidateTagsCache();
    return reordered;
  }

  @Transactional()
  async deleteQuestion(id: string) {
    const tx = this.prisma.tx;
    const question = await tx.question.findUnique({ where: { id } });
    if (!question) {
      throw new AppException(
        ErrorCodes.RECORD_NOT_FOUND,
        `Question "${id}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }

    const answerCount = await tx.answer.count({ where: { questionId: id } });
    if (answerCount > 0) {
      const deactivated = await tx.question.update({
        where: { id },
        data: { isActive: false },
        include: { options: true },
      });
      await this.invalidateTagsCache();
      return deactivated;
    }

    const deletedOrder = question.order;
    await tx.question.delete({ where: { id } });
    await tx.question.updateMany({
      where: { order: { gt: deletedOrder } },
      data: { order: { decrement: 1 } },
    });
    await this.invalidateTagsCache();
    return { id, deleted: true };
  }

  @Transactional()
  async addOptionToQuestion(questionId: string, dto: CreateQuestionOptionDto) {
    const tx = this.prisma.tx;
    const question = await tx.question.findUnique({ where: { id: questionId } });
    if (!question) {
      throw new AppException(
        ErrorCodes.RECORD_NOT_FOUND,
        `Question "${questionId}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }

    const created = await tx.questionOption.create({
      data: {
        questionId,
        text: dto.text,
        tagsOutput: dto.tagsOutput,
      },
    });
    await this.invalidateTagsCache();
    return created;
  }

  @Transactional()
  async updateOption(questionId: string, optionId: string, dto: UpdateQuestionOptionDto) {
    const tx = this.prisma.tx;
    const option = await tx.questionOption.findFirst({
      where: { id: optionId, questionId },
    });
    if (!option) {
      throw new AppException(
        ErrorCodes.RECORD_NOT_FOUND,
        `Option "${optionId}" in question "${questionId}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await tx.questionOption.update({
      where: { id: optionId },
      data: dto,
    });
    await this.invalidateTagsCache();
    return updated;
  }

  @Transactional()
  async deleteOption(questionId: string, optionId: string) {
    const tx = this.prisma.tx;
    const option = await tx.questionOption.findFirst({
      where: { id: optionId, questionId },
    });
    if (!option) {
      throw new AppException(
        ErrorCodes.RECORD_NOT_FOUND,
        `Option "${optionId}" in question "${questionId}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }

    const answerCount = await tx.answer.count({ where: { optionId } });
    if (answerCount > 0) {
      throw new AppException(
        ErrorCodes.FORBIDDEN_RESOURCE,
        `Cannot delete option "${optionId}" because it has existing user responses.`,
        HttpStatus.CONFLICT,
      );
    }

    await tx.questionOption.delete({ where: { id: optionId } });
    await this.invalidateTagsCache();
    return { id: optionId, deleted: true };
  }
}

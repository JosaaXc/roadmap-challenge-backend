import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import type { QuestionResponseDto } from './dto/questionnaire-response.dto.js';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) { }

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
}

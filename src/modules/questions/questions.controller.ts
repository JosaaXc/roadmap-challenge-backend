import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsPublic } from '../../common/decorators/is-public.decorator.js';
import { ApiEnvelopeResponse } from '../../common/swagger/index.js';
import { QuestionsService } from './questions.service.js';
import { QuestionResponseDto } from './dto/questionnaire-response.dto.js';

@ApiTags('Questions')
@IsPublic()
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the active profiling questionnaire (options without inference tags).' })
  @ApiEnvelopeResponse(200, 'Questionnaire retrieved successfully.', QuestionResponseDto, { isArray: true })
  getActiveQuestionnaire() {
    return this.questionsService.getActiveQuestionnaire();
  }
}

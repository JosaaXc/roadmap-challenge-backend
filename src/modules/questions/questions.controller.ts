import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IsPublic } from '../../common/decorators/is-public.decorator.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import { Idempotent } from '../../common/decorators/idempotent.decorator.js';
import { ApiEnvelopeError, ApiEnvelopeResponse } from '../../common/swagger/index.js';
import { QuestionsService } from './questions.service.js';
import { QuestionResponseDto } from './dto/questionnaire-response.dto.js';
import {
  CreateQuestionDto,
  CreateQuestionOptionDto,
  UpdateQuestionDto,
  UpdateQuestionOptionDto,
} from './dto/create-question.dto.js';

@ApiTags('Questions')
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  @IsPublic()
  @ApiOperation({ summary: 'Get the active profiling questionnaire (options without inference tags).' })
  @ApiEnvelopeResponse(200, 'Questionnaire retrieved successfully.', QuestionResponseDto, { isArray: true })
  getActiveQuestionnaire() {
    return this.questionsService.getActiveQuestionnaire();
  }

  @Post()
  @RequirePermissions('questions:create')
  @Idempotent()
  @ApiTags('Admin - Questions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new question with options (Admin only).' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiEnvelopeResponse(201, 'Question created successfully.')
  @ApiEnvelopeError(401, 'Unauthorized.', 'INVALID_TOKEN')
  @ApiEnvelopeError(403, 'Forbidden.', 'FORBIDDEN_RESOURCE')
  createQuestion(@Body() dto: CreateQuestionDto) {
    return this.questionsService.createQuestion(dto);
  }

  @Patch(':id')
  @RequirePermissions('questions:update')
  @ApiTags('Admin - Questions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing question base fields (Admin only).' })
  @ApiParam({ name: 'id', description: 'Question UUID' })
  @ApiEnvelopeResponse(200, 'Question updated successfully.')
  @ApiEnvelopeError(404, 'Question not found.', 'RECORD_NOT_FOUND')
  updateQuestion(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return this.questionsService.updateQuestion(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('questions:delete')
  @ApiTags('Admin - Questions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a question or soft-delete if answers exist (Admin only).' })
  @ApiParam({ name: 'id', description: 'Question UUID' })
  @ApiEnvelopeResponse(204, 'Question deleted successfully.')
  @ApiEnvelopeError(404, 'Question not found.', 'RECORD_NOT_FOUND')
  deleteQuestion(@Param('id') id: string) {
    return this.questionsService.deleteQuestion(id);
  }

  @Post(':id/options')
  @RequirePermissions('questions:create')
  @ApiTags('Admin - Questions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a new option to a question (Admin only).' })
  @ApiParam({ name: 'id', description: 'Question UUID' })
  @ApiEnvelopeResponse(201, 'Option added successfully.')
  @ApiEnvelopeError(404, 'Question not found.', 'RECORD_NOT_FOUND')
  addOptionToQuestion(@Param('id') id: string, @Body() dto: CreateQuestionOptionDto) {
    return this.questionsService.addOptionToQuestion(id, dto);
  }

  @Patch(':id/options/:optionId')
  @RequirePermissions('questions:update')
  @ApiTags('Admin - Questions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an option of a question (Admin only).' })
  @ApiParam({ name: 'id', description: 'Question UUID' })
  @ApiParam({ name: 'optionId', description: 'Option UUID' })
  @ApiEnvelopeResponse(200, 'Option updated successfully.')
  @ApiEnvelopeError(404, 'Option not found.', 'RECORD_NOT_FOUND')
  updateOption(
    @Param('id') id: string,
    @Param('optionId') optionId: string,
    @Body() dto: UpdateQuestionOptionDto,
  ) {
    return this.questionsService.updateOption(id, optionId, dto);
  }

  @Delete(':id/options/:optionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('questions:delete')
  @ApiTags('Admin - Questions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an option from a question (Admin only).' })
  @ApiParam({ name: 'id', description: 'Question UUID' })
  @ApiParam({ name: 'optionId', description: 'Option UUID' })
  @ApiEnvelopeResponse(204, 'Option deleted successfully.')
  @ApiEnvelopeError(404, 'Option not found.', 'RECORD_NOT_FOUND')
  @ApiEnvelopeError(409, 'Option has existing answers.', 'FORBIDDEN_RESOURCE')
  deleteOption(@Param('id') id: string, @Param('optionId') optionId: string) {
    return this.questionsService.deleteOption(id, optionId);
  }
}

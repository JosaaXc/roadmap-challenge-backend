import { Body, Controller, Get, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Idempotent } from '../../common/decorators/idempotent.decorator.js';
import { getAuthContext } from '../../common/middlewares/tracing.context.js';
import { AppException } from '../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../common/exceptions/error-codes.enum.js';
import {
  ApiEnvelopeError,
  ApiEnvelopePaginatedResponse,
  ApiEnvelopeResponse,
} from '../../common/swagger/index.js';
import { PathsService } from './paths.service.js';
import { GeneratePathDto } from './dto/generate-path.dto.js';
import { PathQueryDto } from './dto/path-query.dto.js';
import { PathResponseDto } from './dto/path-response.dto.js';

@ApiTags('Paths')
@ApiBearerAuth()
@Controller('paths')
export class PathsController {
  constructor(private readonly pathsService: PathsService) {}

  private currentUserId(): string {
    const auth = getAuthContext();
    if (!auth) {
      // Unreachable in practice: JwtAuthGuard is global and this controller isn't @IsPublic().
      throw new AppException(ErrorCodes.UNAUTHORIZED, 'Authentication context is missing.', HttpStatus.UNAUTHORIZED);
    }
    return auth.userId;
  }

  @Post('generate')
  @Idempotent()
  @ApiOperation({
    summary: 'Generate a personalized learning path from questionnaire answers.',
    description: 'Idempotent: retry safely with the same Idempotency-Key; the cached replay returns the original path.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Client-generated unique key for this operation.' })
  @ApiEnvelopeResponse(201, 'Learning path generated.', PathResponseDto)
  @ApiEnvelopeError(400, 'Missing Idempotency-Key header.', 'MISSING_IDEMPOTENCY_KEY')
  @ApiEnvelopeError(400, 'Invalid question/option combination.', 'INVALID_QUESTION_OPTION')
  @ApiEnvelopeError(409, 'A request with this Idempotency-Key is already in progress.', 'IDEMPOTENT_REQUEST_IN_PROGRESS')
  @ApiEnvelopeError(422, 'No active courses match the selected answers.', 'INVALID_QUESTION_OPTION')
  generate(@Body() dto: GeneratePathDto) {
    return this.pathsService.generateDynamicPath(this.currentUserId(), dto);
  }

  @Get()
  @ApiOperation({ summary: "List the caller's learning paths (cursor-paginated)." })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Max items (1-50, default 10).' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Last id from the previous page.' })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], description: 'Cursor order (default desc).' })
  @ApiEnvelopePaginatedResponse(200, 'Learning paths retrieved successfully.', PathResponseDto)
  findMine(@Query() dto: PathQueryDto) {
    return this.pathsService.findMyPaths(this.currentUserId(), dto);
  }

  @Get(':id')
  @ApiOperation({ summary: "Get a single learning path with its graph (nodes + edges)." })
  @ApiParam({ name: 'id', description: 'Learning path UUID.' })
  @ApiEnvelopeResponse(200, 'Learning path found.', PathResponseDto)
  @ApiEnvelopeError(404, 'Learning path not found (or belongs to another user).', 'PATH_NOT_FOUND')
  findOne(@Param('id') id: string) {
    return this.pathsService.findPathById(this.currentUserId(), id);
  }
}

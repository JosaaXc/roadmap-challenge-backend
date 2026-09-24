import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { PathResponseDto, NodeProgressResponseDto, FavoriteResponseDto, VisibilityResponseDto } from './dto/path-response.dto.js';
import { CommunityPathDto } from './dto/community-path.dto.js';
import { CreateCustomNodeDto } from './dto/create-custom-node.dto.js';
import { PathMapper } from './mappers/path.mapper.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';

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
  @ApiEnvelopeError(401, 'Missing, malformed, invalid or expired access token (refresh and retry on TOKEN_EXPIRED).', 'INVALID_TOKEN')
  @ApiEnvelopeError(400, 'Missing Idempotency-Key header.', 'MISSING_IDEMPOTENCY_KEY')
  @ApiEnvelopeError(400, 'Invalid question/option combination.', 'INVALID_QUESTION_OPTION')
  @ApiEnvelopeError(409, 'A request with this Idempotency-Key is already in progress.', 'IDEMPOTENT_REQUEST_IN_PROGRESS')
  @ApiEnvelopeError(422, 'No active courses match the selected answers.', 'INVALID_QUESTION_OPTION')
  async generate(@Body() dto: GeneratePathDto): Promise<PathResponseDto> {
    const path = await this.pathsService.generateDynamicPath(this.currentUserId(), dto);
    return PathMapper.toResponseDto(path, this.currentUserId());
  }

  @Get()
  @ApiOperation({ summary: "List the caller's learning paths (cursor-paginated)." })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Max items (1-50, default 10).' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Last id from the previous page.' })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], description: 'Cursor order (default desc).' })
  @ApiEnvelopePaginatedResponse(200, 'Learning paths retrieved successfully.', PathResponseDto)
  @ApiEnvelopeError(401, 'Missing, malformed, invalid or expired access token (refresh and retry on TOKEN_EXPIRED).', 'INVALID_TOKEN')
  async findMine(@Query() dto: PathQueryDto) {
    const page = await this.pathsService.findMyPaths(this.currentUserId(), dto);
    return {
      ...page,
      items: page.items.map((item) => PathMapper.toResponseDto(item, this.currentUserId())),
    };
  }

  @Get('community')
  @ApiOperation({
    summary: 'Discover public community paths (fork them to start your own copy).',
    description:
      'Progress shown belongs to the author (social proof). Favorite/fork from here, then track progress on your own copy.',
  })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Max items (1-50, default 10).' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Last id from the previous page.' })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], description: 'Cursor order (default desc).' })
  @ApiEnvelopePaginatedResponse(200, 'Community paths retrieved successfully.', CommunityPathDto)
  @ApiEnvelopeError(401, 'Missing, malformed, invalid or expired access token (refresh and retry on TOKEN_EXPIRED).', 'INVALID_TOKEN')
  findCommunity(@Query() dto: PathQueryDto) {
    return this.pathsService.findCommunityPaths(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single learning path with its graph (nodes + edges).',
    description:
      'Own paths include your live nextStep. Foreign public paths return nextStep: null (their progress is not yours) — fork to start tracking.',
  })
  @ApiParam({ name: 'id', description: 'Learning path UUID.' })
  @ApiEnvelopeResponse(200, 'Learning path found.', PathResponseDto)
  @ApiEnvelopeError(401, 'Missing, malformed, invalid or expired access token (refresh and retry on TOKEN_EXPIRED).', 'INVALID_TOKEN')
  @ApiEnvelopeError(404, 'Learning path not found (or belongs to another user).', 'PATH_NOT_FOUND')
  async findOne(@Param('id') id: string): Promise<PathResponseDto> {
    const path = await this.pathsService.findPathById(this.currentUserId(), id);
    return PathMapper.toResponseDto(path, this.currentUserId());
  }

  @Patch(':pathId/nodes/:nodeId/complete')
  @ApiOperation({ summary: 'Toggle a node completion flag and recalculate path progress.' })
  @ApiParam({ name: 'pathId', description: 'Learning path UUID.' })
  @ApiParam({ name: 'nodeId', description: 'Path node UUID.' })
  @ApiEnvelopeResponse(200, 'Node completion toggled.', NodeProgressResponseDto)
  @ApiEnvelopeError(401, 'Missing, malformed, invalid or expired access token (refresh and retry on TOKEN_EXPIRED).', 'INVALID_TOKEN')
  @ApiEnvelopeError(404, 'Learning path not found (or belongs to another user).', 'PATH_NOT_FOUND')
  @ApiEnvelopeError(404, 'Node not found in this path.', 'RECORD_NOT_FOUND')
  toggleNodeCompletion(@Param('pathId') pathId: string, @Param('nodeId') nodeId: string) {
    return this.pathsService.toggleNodeCompletion(this.currentUserId(), pathId, nodeId);
  }

  @Patch(':pathId/favorite')
  @ApiOperation({ summary: 'Toggle the favorite flag of a learning path.' })
  @ApiParam({ name: 'pathId', description: 'Learning path UUID.' })
  @ApiEnvelopeResponse(200, 'Favorite flag toggled.', FavoriteResponseDto)
  @ApiEnvelopeError(401, 'Missing, malformed, invalid or expired access token (refresh and retry on TOKEN_EXPIRED).', 'INVALID_TOKEN')
  @ApiEnvelopeError(404, 'Learning path not found (or belongs to another user).', 'PATH_NOT_FOUND')
  toggleFavorite(@Param('pathId') pathId: string) {
    return this.pathsService.toggleFavorite(this.currentUserId(), pathId);
  }

  @Post(':pathId/nodes')
  @Idempotent()
  @ApiOperation({
    summary: 'Append a custom external-link node to your own path.',
    description: 'Idempotent: retry safely with the same Idempotency-Key.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Client-generated unique key for this operation.' })
  @ApiParam({ name: 'pathId', description: 'Learning path UUID.' })
  @ApiEnvelopeResponse(201, 'Custom node created.', NodeProgressResponseDto)
  @ApiEnvelopeError(401, 'Missing, malformed, invalid or expired access token (refresh and retry on TOKEN_EXPIRED).', 'INVALID_TOKEN')
  @ApiEnvelopeError(400, 'Missing Idempotency-Key header.', 'MISSING_IDEMPOTENCY_KEY')
  @ApiEnvelopeError(404, 'Learning path not found (or belongs to another user).', 'PATH_NOT_FOUND')
  @ApiEnvelopeError(404, 'Previous node not found in this path.', 'RECORD_NOT_FOUND')
  @ApiEnvelopeError(409, 'A request with this Idempotency-Key is already in progress.', 'IDEMPOTENT_REQUEST_IN_PROGRESS')
  addCustomNode(@Param('pathId') pathId: string, @Body() dto: CreateCustomNodeDto) {
    return this.pathsService.addCustomNode(this.currentUserId(), pathId, dto);
  }

  @Patch(':pathId/visibility')
  @ApiOperation({ summary: 'Toggle public visibility of a learning path (community sharing).' })
  @ApiParam({ name: 'pathId', description: 'Learning path UUID.' })
  @ApiEnvelopeResponse(200, 'Visibility toggled.', VisibilityResponseDto)
  @ApiEnvelopeError(401, 'Missing, malformed, invalid or expired access token (refresh and retry on TOKEN_EXPIRED).', 'INVALID_TOKEN')
  @ApiEnvelopeError(404, 'Learning path not found (or belongs to another user).', 'PATH_NOT_FOUND')
  toggleVisibility(@Param('pathId') pathId: string) {
    return this.pathsService.toggleVisibility(this.currentUserId(), pathId);
  }

  @Post(':pathId/fork')
  @Idempotent()
  @ApiOperation({
    summary: "Fork a public path into your own profile (fresh copy at 0%).",
    description: 'Idempotent: retry safely with the same Idempotency-Key; the replay returns the original fork.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Client-generated unique key for this operation.' })
  @ApiParam({ name: 'pathId', description: 'Source learning path UUID.' })
  @ApiEnvelopeResponse(201, 'Learning path forked.', PathResponseDto)
  @ApiEnvelopeError(401, 'Missing, malformed, invalid or expired access token (refresh and retry on TOKEN_EXPIRED).', 'INVALID_TOKEN')
  @ApiEnvelopeError(400, 'Missing Idempotency-Key header.', 'MISSING_IDEMPOTENCY_KEY')
  @ApiEnvelopeError(404, 'Source path not found or not public.', 'PATH_NOT_FOUND')
  @ApiEnvelopeError(409, 'A request with this Idempotency-Key is already in progress.', 'IDEMPOTENT_REQUEST_IN_PROGRESS')
  async fork(@Param('pathId') pathId: string): Promise<PathResponseDto> {
    const path = await this.pathsService.forkPath(this.currentUserId(), pathId);
    return PathMapper.toResponseDto(path, this.currentUserId());
  }

  @Delete(':pathId/nodes/:nodeId')
  @ApiOperation({ summary: 'Delete a custom external-link node (DevTalles course nodes are protected).' })
  @ApiParam({ name: 'pathId', description: 'Learning path UUID.' })
  @ApiParam({ name: 'nodeId', description: 'Custom node UUID.' })
  @ApiEnvelopeResponse(200, 'Custom node deleted.', NodeProgressResponseDto)
  @ApiEnvelopeError(401, 'Missing, malformed, invalid or expired access token (refresh and retry on TOKEN_EXPIRED).', 'INVALID_TOKEN')
  @ApiEnvelopeError(404, 'Learning path not found (or belongs to another user).', 'PATH_NOT_FOUND')
  @ApiEnvelopeError(404, 'Custom node not found in this path.', 'RECORD_NOT_FOUND')
  deleteCustomNode(@Param('pathId') pathId: string, @Param('nodeId') nodeId: string) {
    return this.pathsService.deleteCustomNode(this.currentUserId(), pathId, nodeId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a learning path (logical delete, recoverable).' })
  @ApiParam({ name: 'id', description: 'Learning path UUID.' })
  @ApiResponse({ status: 204, description: 'Learning path deleted (no response body).' })
  @ApiEnvelopeError(401, 'Missing, malformed, invalid or expired access token (refresh and retry on TOKEN_EXPIRED).', 'INVALID_TOKEN')
  @ApiEnvelopeError(404, 'Learning path not found (or belongs to another user).', 'PATH_NOT_FOUND')
  remove(@Param('id') id: string): Promise<void> {
    return this.pathsService.deletePath(this.currentUserId(), id);
  }

  @Get('admin/all')
  @RequirePermissions('paths:manage')
  @ApiTags('Admin - Paths')
  @ApiOperation({ summary: 'List all paths globally for supervision (Admin only).' })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Max items (1-50, default 10).' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Last id from the previous page.' })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], description: 'Cursor order (default desc).' })
  @ApiEnvelopePaginatedResponse(200, 'Paths retrieved successfully (ignores privacy flags).', CommunityPathDto)
  @ApiEnvelopeError(401, 'Unauthorized or missing token.', 'INVALID_TOKEN')
  @ApiEnvelopeError(403, 'Forbidden. Requires paths:manage permission.', 'FORBIDDEN_RESOURCE')
  findAllPathsAdmin(@Query() dto: PathQueryDto) {
    return this.pathsService.findAllPathsAdmin(dto);
  }

  @Delete('admin/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('paths:manage')
  @ApiTags('Admin - Paths')
  @ApiOperation({ summary: 'Force delete any learning path (Admin only).' })
  @ApiParam({ name: 'id', description: 'Learning path UUID.' })
  @ApiEnvelopeResponse(204, 'Learning path force-deleted successfully.')
  @ApiEnvelopeError(401, 'Unauthorized or missing token.', 'INVALID_TOKEN')
  @ApiEnvelopeError(403, 'Forbidden. Requires paths:manage permission.', 'FORBIDDEN_RESOURCE')
  @ApiEnvelopeError(404, 'Learning path not found.', 'PATH_NOT_FOUND')
  adminDeletePath(@Param('id') id: string): Promise<void> {
    return this.pathsService.adminDeletePath(id);
  }
}

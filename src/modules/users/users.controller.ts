import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiEnvelopeResponse } from '../../common/swagger/index.js';
import { getAuthContext } from '../../common/middlewares/tracing.context.js';
import { AppException } from '../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../common/exceptions/error-codes.enum.js';
import { HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UserProfileResponseDto } from './dto/user-response.dto.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: "Get the authenticated user's own profile." })
  @ApiEnvelopeResponse(200, 'Profile retrieved.', UserProfileResponseDto)
  getMe() {
    const auth = getAuthContext();
    if (!auth) {
      // Unreachable in practice: JwtAuthGuard is global and this route isn't @IsPublic().
      throw new AppException(
        ErrorCodes.UNAUTHORIZED,
        'Authentication context is missing.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return this.usersService.getProfile(auth.userId);
  }
}

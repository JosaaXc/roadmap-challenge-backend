import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodes } from './error-codes.enum.js';

export class AppException extends HttpException {
  public readonly code: ErrorCodes;
  public readonly details?: Record<string, any> | any[];

  constructor(
    code: ErrorCodes,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, any> | any[],
  ) {
    super({ code, message, details }, status);
    this.code = code;
    this.details = details;
  }
}

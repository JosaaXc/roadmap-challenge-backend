import { Module } from '@nestjs/common';
import { PathsController } from './paths.controller.js';
import { PathsService } from './paths.service.js';

@Module({
  controllers: [PathsController],
  providers: [PathsService],
  exports: [PathsService],
})
export class PathsModule {}

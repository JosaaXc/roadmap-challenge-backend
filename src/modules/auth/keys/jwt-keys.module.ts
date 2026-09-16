import { Module } from '@nestjs/common';
import { JwtKeysService } from './jwt-keys.service.js';

@Module({
  providers: [JwtKeysService],
  exports: [JwtKeysService],
})
export class JwtKeysModule { }

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * We don't run express-session, so passport must be told explicitly not to
 * rely on it (it would otherwise try req.login()/session serialization).
 */
@Injectable()
export class DiscordAuthGuard extends AuthGuard('discord') {
  constructor() {
    super({ session: false });
  }
}

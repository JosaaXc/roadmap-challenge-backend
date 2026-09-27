import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Provider-agnostic outbound mail over SMTP (Gmail, Brevo, SES,
 * Mailgun...). Switching providers = env vars + restart, no code
 * changes. Disabled by default (MAIL_ENABLED=false): callers must
 * fall back to dev-mode logging instead.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger('MAIL');
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (!this.isEnabled) {
      this.logger.log('Outbound mail disabled (MAIL_ENABLED=false).');
      return;
    }
    const host = this.configService.get<string>('MAIL_HOST');
    if (!host) {
      this.logger.warn('MAIL_ENABLED=true but MAIL_HOST is unset: mail will fail at send time.');
      return;
    }
    this.transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('MAIL_PORT', 587),
      secure: this.configService.get<boolean>('MAIL_SECURE', false),
      auth: this.buildAuth(),
    });
    this.logger.log(`Outbound mail enabled via ${host}.`);
  }

  get isEnabled(): boolean {
    return this.configService.get<boolean>('MAIL_ENABLED', false);
  }

  async sendPasswordResetOtp(to: string, otp: string, ttlMinutes: number): Promise<void> {
    await this.send({
      to,
      subject: 'Your password reset code',
      text:
        `Your password reset code is: ${otp}\n\n` +
        `It expires in ${ttlMinutes} minutes. If you did not request it, ignore this email.`,
    });
  }

  private async send(options: { to: string; subject: string; text: string }): Promise<void> {
    if (!this.transporter) {
      throw new Error('[MAIL] Transporter not initialized: check MAIL_* env vars.');
    }
    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM', 'no-reply@codequest.app'),
      ...options,
    });
  }

  private buildAuth(): { user: string; pass: string } | undefined {
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');
    if (!user || !pass) return undefined;
    return { user, pass };
  }
}

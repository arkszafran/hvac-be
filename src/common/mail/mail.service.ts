import { readFile } from 'node:fs/promises';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import nodemailer, { type Transporter } from 'nodemailer';
import type SMTPPool from 'nodemailer/lib/smtp-pool';

import type { SendEmailInput } from './mail.types';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter<
    SMTPPool.SentMessageInfo,
    SMTPPool.Options
  >;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport(this.getTransportOptions());
  }

  async sendEmail(input: SendEmailInput): Promise<void> {
    const template = await this.resolveTemplate(input);
    const html = Handlebars.compile(template)(input.templateVariables ?? {});

    try {
      await this.transporter.sendMail({
        from: {
          address: this.configService.getOrThrow<string>('SMTP_FROM_ADDRESS'),
          name: this.configService.getOrThrow<string>('SMTP_FROM_NAME'),
        },
        to: this.getRecipients(input.recipients),
        subject: input.subject,
        html,
      });
    } catch (error) {
      this.logger.error(
        'Email delivery failed.',
        error instanceof Error ? error.stack : undefined,
      );

      throw new ServiceUnavailableException('Email could not be sent.');
    }
  }

  private async resolveTemplate(input: SendEmailInput): Promise<string> {
    if (input.template?.trim()) {
      return input.template;
    }

    if (!input.templateFilePath?.trim()) {
      throw new BadRequestException(
        'Email template or template file path is required.',
      );
    }

    try {
      return await readFile(input.templateFilePath, 'utf8');
    } catch (error) {
      this.logger.error(
        'Email template file could not be read.',
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException(
        'Email template file could not be read.',
      );
    }
  }

  private getRecipients(recipients: SendEmailInput['recipients']): string[] {
    return typeof recipients === 'string' ? [recipients] : [...recipients];
  }

  private getTransportOptions(): SMTPPool.Options {
    const smtpUrl = new URL(this.configService.getOrThrow<string>('SMTP_URL'));
    const secure = smtpUrl.protocol === 'smtps:';

    return {
      host: smtpUrl.hostname,
      port: this.getSmtpPort(smtpUrl, secure),
      secure,
      auth: {
        user: this.configService.getOrThrow<string>('SMTP_USER'),
        pass: this.configService.getOrThrow<string>('SMTP_PASSWORD'),
      },
      requireTLS: this.getBooleanEnv('SMTP_REQUIRE_TLS', false),
      pool: true,
      maxConnections: this.getNumberEnv('SMTP_MAX_CONNECTIONS', 5),
      maxMessages: this.getNumberEnv('SMTP_MAX_MESSAGES', 100),
      connectionTimeout: this.getNumberEnv('SMTP_CONNECTION_TIMEOUT_MS', 10000),
      greetingTimeout: this.getNumberEnv('SMTP_GREETING_TIMEOUT_MS', 10000),
      socketTimeout: this.getNumberEnv('SMTP_SOCKET_TIMEOUT_MS', 30000),
      tls: {
        rejectUnauthorized: this.getBooleanEnv(
          'SMTP_REJECT_UNAUTHORIZED',
          true,
        ),
      },
    };
  }

  private getSmtpPort(smtpUrl: URL, secure: boolean): number {
    if (smtpUrl.port) {
      return Number(smtpUrl.port);
    }

    return secure ? 465 : 587;
  }

  private getBooleanEnv(key: string, defaultValue: boolean): boolean {
    const configured = this.configService.get<string>(key);

    if (configured === undefined) {
      return defaultValue;
    }

    return ['true', '1', 'yes', 'on'].includes(configured.trim().toLowerCase());
  }

  private getNumberEnv(key: string, defaultValue: number): number {
    const configured = this.configService.get<string | number>(key);

    if (configured === undefined) {
      return defaultValue;
    }

    return Number(configured);
  }
}

import { Buffer } from 'node:buffer';
import { join } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MailService } from '../../../../common/mail/mail.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

@Injectable()
export class TenantUserCreatedMailHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async handle(input: {
    readonly userId: string;
    readonly temporaryPassword: string;
  }): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User for tenant created email not found.');
    }

    await this.mailService.sendEmail({
      recipients: user.email,
      subject: 'Dostep do konta',
      templateFilePath: this.getTemplateFilePath(),
      templateVariables: {
        name: user.name,
        email: user.email,
        temporaryPassword: input.temporaryPassword,
        setupUrl: this.getSetupUrl(user.email, input.temporaryPassword),
      },
    });
  }

  private getSetupUrl(email: string, temporaryPassword: string): string {
    const baseUrl = this.configService
      .getOrThrow<string>('FRONTEND_TENANT_ORIGIN')
      .replace(/\/$/, '');
    const payload = Buffer.from(
      JSON.stringify({ email, password: temporaryPassword }),
      'utf8',
    ).toString('base64url');

    return `${baseUrl}/auto-login#${payload}`;
  }

  private getTemplateFilePath(): string {
    return join(__dirname, '..', 'templates', 'tenant-user-created.hbs');
  }
}

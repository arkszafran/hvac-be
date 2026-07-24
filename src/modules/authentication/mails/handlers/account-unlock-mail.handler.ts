import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MailService } from '../../../../common/mail/mail.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuthenticationTokenService } from '../../authentication-token.service';

const ACCOUNT_UNLOCK_CODE_BYTES = 32;

@Injectable()
export class AccountUnlockMailHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly tokenService: AuthenticationTokenService,
  ) {}

  async handle(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User for account unlock email not found.');
    }

    const code = this.createUnlockCode();
    const accountUnlockCodeHash = await this.tokenService.hashToken(code);
    const accountUnlockCodeValidTo = this.getUnlockCodeValidTo();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        accountUnlockCodeHash,
        accountUnlockCodeValidTo,
        accountUnlockIncorrectCounter: 0,
      },
    });

    await this.mailService.sendEmail({
      recipients: user.email,
      subject: 'Odblokowanie konta',
      templateFilePath: this.getTemplateFilePath(),
      templateVariables: {
        name: user.name,
        unlockUrl: this.getUnlockUrl(user.id, code),
      },
    });
  }

  private createUnlockCode(): string {
    return randomBytes(ACCOUNT_UNLOCK_CODE_BYTES).toString('base64url');
  }

  private getUnlockCodeValidTo(now = new Date()): Date {
    const validTo = new Date(now);
    validTo.setMinutes(validTo.getMinutes() + this.getUnlockCodeTtlMinutes());

    return validTo;
  }

  private getUnlockCodeTtlMinutes(): number {
    return Number(
      this.configService.getOrThrow<string | number>(
        'ACCOUNT_UNLOCK_CODE_TTL_MINUTES',
      ),
    );
  }

  private getUnlockUrl(userId: string, code: string): string {
    const baseUrl = this.configService
      .getOrThrow<string>('FRONTEND_TENANT_ORIGIN')
      .replace(/\/$/, '');
    const payload = Buffer.from(
      JSON.stringify({ code, userId }),
      'utf8',
    ).toString('base64url');

    return `${baseUrl}/account-unlock#${payload}`;
  }

  private getTemplateFilePath(): string {
    return join(__dirname, '..', 'templates', 'account-unlock.hbs');
  }
}

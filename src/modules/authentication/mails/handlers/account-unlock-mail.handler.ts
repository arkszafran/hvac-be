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

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        accountUnlockCodeHash,
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

  private getUnlockUrl(userId: string, code: string): string {
    const baseUrl = this.configService
      .getOrThrow<string>('BE_BASE_URL')
      .replace(/\/$/, '');
    const params = new URLSearchParams({
      userId,
      code,
    });

    return `${baseUrl}/authentication/account-unlock?${params.toString()}`;
  }

  private getTemplateFilePath(): string {
    return join(__dirname, '..', 'templates', 'account-unlock.hbs');
  }
}

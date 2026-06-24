import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MailService } from '../../../../common/mail/mail.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuthenticationTokenService } from '../../authentication-token.service';

const PASSWORD_RESET_CODE_BYTES = 32;

@Injectable()
export class PasswordResetMailHandler {
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
      throw new NotFoundException('User for password reset email not found.');
    }

    const code = this.createResetCode();
    const passwordResetCodeHash = await this.tokenService.hashToken(code);
    const passwordResetCodeValidTo = this.getResetCodeValidTo();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetCodeHash,
        passwordResetCodeValidTo,
        passwordResetIncorrectCounter: 0,
      },
    });

    await this.mailService.sendEmail({
      recipients: user.email,
      subject: 'Reset hasla',
      templateFilePath: this.getTemplateFilePath(),
      templateVariables: {
        name: user.name,
        resetUrl: this.getResetUrl(user.id, code),
        validMinutes: this.getResetCodeTtlMinutes(),
      },
    });
  }

  private createResetCode(): string {
    return randomBytes(PASSWORD_RESET_CODE_BYTES).toString('base64url');
  }

  private getResetUrl(userId: string, code: string): string {
    const baseUrl = this.configService
      .getOrThrow<string>('FRONTEND_ORIGIN')
      .replace(/\/$/, '');
    const params = new URLSearchParams({
      userId,
      code,
    });

    return `${baseUrl}/password-reset#${params.toString()}`;
  }

  private getResetCodeValidTo(now = new Date()): Date {
    const validTo = new Date(now);
    validTo.setMinutes(validTo.getMinutes() + this.getResetCodeTtlMinutes());

    return validTo;
  }

  private getResetCodeTtlMinutes(): number {
    return Number(
      this.configService.getOrThrow<string | number>(
        'PASSWORD_RESET_CODE_TTL_MINUTES',
      ),
    );
  }

  private getTemplateFilePath(): string {
    return join(__dirname, '..', 'templates', 'password-reset.hbs');
  }
}

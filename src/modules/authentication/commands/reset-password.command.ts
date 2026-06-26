import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@generated/prisma/enums';

import { hashPassword } from '../../../common/security/password/password';
import { apiError, apiSuccess } from '../../../common/types/api-response.type';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AUTH_ERROR_CODES } from '../authentication.constants';
import { AuthenticationAccountStatusService } from '../authentication-account-status.service';
import { AuthenticationTokenService } from '../authentication-token.service';
import type { ResetPasswordDto } from '../dto/reset-password.dto';
import { AuthenticationMailQueueService } from '../mails/authentication-mail-queue.service';
import { AuthenticationMailType } from '../mails/authentication-mail-type.enum';

@Injectable()
export class ResetPasswordCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: AuthenticationTokenService,
    private readonly configService: ConfigService,
    private readonly mailQueueService: AuthenticationMailQueueService,
    private readonly accountStatusService: AuthenticationAccountStatusService,
  ) {}

  async execute(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: {
        id: true,
        status: true,
        accountUnlockCodeHash: true,
        passwordResetCodeHash: true,
        passwordResetCodeValidTo: true,
        passwordResetIncorrectCounter: true,
      },
    });

    if (user) {
      await this.accountStatusService.throwIfBlocked(user);
    }

    if (
      !user?.passwordResetCodeHash ||
      !user.passwordResetCodeValidTo ||
      user.passwordResetCodeValidTo <= new Date()
    ) {
      throwInvalidPasswordResetCodeException();
    }

    const isResetCodeValid = await this.tokenService.verifyToken(
      dto.code,
      user.passwordResetCodeHash,
    );

    if (!isResetCodeValid) {
      await this.handleInvalidResetCode(user);

      throwInvalidPasswordResetCodeException();
    }

    const password = await hashPassword(dto.password);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password,
        incorrectLoginCounter: 0,
        incorrectPINCounter: 0,
        refreshTokenHash: null,
        refreshTokenValidTo: null,
        sessionUnlockedUntil: null,
        passwordResetCodeHash: null,
        passwordResetCodeValidTo: null,
        passwordResetIncorrectCounter: 0,
      },
    });

    return apiSuccess();
  }

  private async handleInvalidResetCode(user: {
    readonly id: string;
  }): Promise<void> {
    const passwordResetRetriesNumber = Number(
      this.configService.getOrThrow<string | number>(
        'PASSWORD_RESET_CODE_RETRIES_NUMBER',
      ),
    );
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetIncorrectCounter: {
          increment: 1,
        },
      },
      select: {
        id: true,
        accountUnlockCodeHash: true,
        passwordResetIncorrectCounter: true,
      },
    });

    if (
      updatedUser.passwordResetIncorrectCounter < passwordResetRetriesNumber
    ) {
      return;
    }

    const blockResult = await this.prisma.user.updateMany({
      where: {
        id: updatedUser.id,
        status: {
          not: UserStatus.blocked,
        },
      },
      data: {
        status: UserStatus.blocked,
        passwordResetCodeHash: null,
        passwordResetCodeValidTo: null,
        refreshTokenHash: null,
        refreshTokenValidTo: null,
        sessionUnlockedUntil: null,
      },
    });

    if (blockResult.count > 0 && !updatedUser.accountUnlockCodeHash) {
      await this.mailQueueService.queueEmail({
        userId: updatedUser.id,
        type: AuthenticationMailType.ACCOUNT_UNLOCK,
      });
    }
  }
}

function throwInvalidPasswordResetCodeException(): never {
  throw new BadRequestException(
    apiError({
      code: AUTH_ERROR_CODES.invalidPasswordResetCode,
      message: 'Password reset code is invalid or expired.',
    }),
  );
}

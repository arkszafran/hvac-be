import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../common/types/api-response.type';
import { AuthenticationAccountStatusService } from '../authentication-account-status.service';
import type { RequestPasswordResetDto } from '../dto/request-password-reset.dto';
import { AuthenticationMailQueueService } from '../mails/authentication-mail-queue.service';
import { AuthenticationMailType } from '../mails/authentication-mail-type.enum';

@Injectable()
export class RequestPasswordResetCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailQueueService: AuthenticationMailQueueService,
    private readonly accountStatusService: AuthenticationAccountStatusService,
    private readonly configService: ConfigService,
  ) {}

  async execute(dto: RequestPasswordResetDto): Promise<ApiSuccessResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      select: {
        id: true,
        status: true,
        accountUnlockCodeHash: true,
      },
    });

    if (user) {
      await this.accountStatusService.throwIfBlocked(user);

      const now = new Date();
      const nextRequestAvailableAt =
        this.getNextPasswordResetRequestAvailableAt(now);
      const updateResult = await this.prisma.user.updateMany({
        where: {
          id: user.id,
          OR: [
            { passwordResetRequestAvailableAt: null },
            { passwordResetRequestAvailableAt: { lte: now } },
          ],
        },
        data: {
          passwordResetRequestAvailableAt: nextRequestAvailableAt,
        },
      });

      if (updateResult.count > 0) {
        await this.mailQueueService.queueEmail({
          userId: user.id,
          type: AuthenticationMailType.PASSWORD_RESET,
        });
      }
    }

    return apiSuccess();
  }

  private getNextPasswordResetRequestAvailableAt(now: Date): Date {
    const availableAt = new Date(now);
    availableAt.setMinutes(
      availableAt.getMinutes() +
        Number(
          this.configService.getOrThrow<string | number>(
            'PASSWORD_RESET_REQUEST_COOLDOWN_MINUTES',
          ),
        ),
    );

    return availableAt;
  }
}

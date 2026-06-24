import { Injectable } from '@nestjs/common';

import { apiSuccess } from '../../../common/types/api-response.type';
import { PrismaService } from '../../../common/prisma/prisma.service';
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
  ) {}

  async execute(dto: RequestPasswordResetDto) {
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

      await this.mailQueueService.queueEmail({
        userId: user.id,
        type: AuthenticationMailType.PASSWORD_RESET,
      });
    }

    return apiSuccess();
  }
}

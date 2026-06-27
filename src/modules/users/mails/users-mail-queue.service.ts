import { Injectable } from '@nestjs/common';

import { QueueService } from '../../../common/queues/queue.service';
import { Queue } from '../../../common/queues/queues.enum';
import { UsersMailType } from './users-mail-type.enum';

@Injectable()
export class UsersMailQueueService {
  constructor(private readonly queueService: QueueService) {}

  queueTenantUserCreatedEmail(input: {
    readonly userId: string;
    readonly temporaryPassword: string;
  }): Promise<string | undefined> {
    return this.queueService.enqueue({
      queueName: Queue.USERS_EMAIL,
      type: Queue.USERS_EMAIL,
      payload: {
        userId: input.userId,
        temporaryPassword: input.temporaryPassword,
        type: UsersMailType.TENANT_USER_CREATED,
      },
    });
  }
}

import { Injectable } from '@nestjs/common';

import { QueueService } from '../../../common/queues/queue.service';
import { Queue } from '../../../common/queues/queues.enum';
import { AuthenticationMailType } from './authentication-mail-type.enum';

@Injectable()
export class AuthenticationMailQueueService {
  constructor(private readonly queueService: QueueService) {}

  queueEmail(input: {
    readonly userId: string;
    readonly type: AuthenticationMailType;
  }): Promise<string | undefined> {
    return this.queueService.enqueue({
      queueName: Queue.AUTH_EMAIL,
      type: Queue.AUTH_EMAIL,
      payload: {
        userId: input.userId,
        type: input.type,
      },
    });
  }
}

import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';

import {
  type JobHandler,
  JobsHandlersRegistry,
} from '../../../common/queues/jobs-handlers.registry';
import { Queue } from '../../../common/queues/queues.enum';
import type { UsersEmailJobPayload } from './users-mail.types';
import { UsersMailType } from './users-mail-type.enum';
import { TenantUserCreatedMailHandler } from './handlers/tenant-user-created-mail.handler';

@Injectable()
export class UsersMailsHandler
  implements OnModuleInit, JobHandler<UsersEmailJobPayload>
{
  constructor(
    private readonly registry: JobsHandlersRegistry,
    private readonly tenantUserCreatedMailHandler: TenantUserCreatedMailHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(Queue.USERS_EMAIL, this);
  }

  async handle(payload: UsersEmailJobPayload): Promise<void> {
    switch (payload.type) {
      case UsersMailType.TENANT_USER_CREATED:
        await this.tenantUserCreatedMailHandler.handle({
          userId: payload.userId,
          temporaryPassword: payload.temporaryPassword,
        });
        return;
      default:
        throw new BadRequestException('Unsupported users email type.');
    }
  }
}

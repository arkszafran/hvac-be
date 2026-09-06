import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';

import {
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import {
  generateTemporaryPassword,
  hashPassword,
} from '../../../../common/security/password/password';
import { UsersMailQueueService } from '../../mails/users-mail-queue.service';
import { TenantKeyService } from '../../../tenant-encryption/tenant-key.service';
import {
  type CreateTenantWithAdminUserInput,
  UsersRepository,
} from '../../infrastructure/users.repository';
import { CreateTenantCommand } from '../impl/create-tenant.command';

type CreateTenantResult = {
  readonly tenantId: string;
  readonly userId: string;
};

@CommandHandler(CreateTenantCommand)
export class CreateTenantHandler implements ICommandHandler<
  CreateTenantCommand,
  ApiSuccessResponse<CreateTenantResult>
> {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly tenantKeyService: TenantKeyService,
    private readonly mailQueueService: UsersMailQueueService,
  ) {}

  async execute(
    command: CreateTenantCommand,
  ): Promise<ApiSuccessResponse<CreateTenantResult>> {
    const email = command.dto.user.email.trim().toLowerCase();
    const existingUserId = await this.usersRepository.findUserIdByEmail(email);
    const tenantId = randomUUID();
    const encryptionKey =
      await this.tenantKeyService.prepareInitialKey(tenantId);

    let temporaryPassword: string | undefined;
    let user: CreateTenantWithAdminUserInput['user'];

    if (existingUserId) {
      user = { existingUserId };
    } else {
      temporaryPassword = generateTemporaryPassword();
      user = {
        name: command.dto.user.name,
        email,
        password: await hashPassword(temporaryPassword),
      };
    }

    const result = await this.usersRepository.createTenantWithAdminUser({
      tenant: {
        name: command.dto.tenant.name,
        personName: command.dto.tenant.personName,
        street: command.dto.tenant.street,
        city: command.dto.tenant.city,
        zip: command.dto.tenant.zip,
        tax: command.dto.tenant.tax,
      },
      user,
      encryptionKey,
    });

    if (temporaryPassword) {
      await this.mailQueueService.queueTenantUserCreatedEmail({
        userId: result.userId,
        temporaryPassword,
      });
    }

    return apiSuccess(result);
  }
}

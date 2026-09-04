import { ConflictException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';

import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import {
  generateTemporaryPassword,
  hashPassword,
} from '../../../../common/security/password/password';
import { UsersMailQueueService } from '../../mails/users-mail-queue.service';
import { TenantKeyService } from '../../../tenant-encryption/tenant-key.service';
import { USERS_ERROR_CODES } from '../../users.constants';
import { UsersRepository } from '../../infrastructure/users.repository';
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

    if (await this.usersRepository.hasUserWithEmail(email)) {
      throw new ConflictException(
        apiError({
          code: USERS_ERROR_CODES.emailAlreadyExists,
          message: 'User with this email already exists.',
        }),
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const password = await hashPassword(temporaryPassword);
    const tenantId = randomUUID();
    const encryptionKey =
      await this.tenantKeyService.prepareInitialKey(tenantId);
    const result = await this.usersRepository.createTenantWithFirstUser({
      tenant: {
        name: command.dto.tenant.name,
        personName: command.dto.tenant.personName,
        street: command.dto.tenant.street,
        city: command.dto.tenant.city,
        zip: command.dto.tenant.zip,
        tax: command.dto.tenant.tax,
      },
      user: {
        name: command.dto.user.name,
        email,
        password,
      },
      encryptionKey,
    });

    await this.mailQueueService.queueTenantUserCreatedEmail({
      userId: result.userId,
      temporaryPassword,
    });

    return apiSuccess(result);
  }
}

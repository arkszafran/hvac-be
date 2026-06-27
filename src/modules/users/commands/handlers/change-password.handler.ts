import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import {
  hashPassword,
  verifyPassword,
} from '../../../../common/security/password/password';
import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { UsersRepository } from '../../infrastructure/users.repository';
import { USERS_ERROR_CODES } from '../../users.constants';
import { ChangePasswordCommand } from '../impl/change-password.command';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<
  ChangePasswordCommand,
  ApiSuccessResponse
> {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(command: ChangePasswordCommand): Promise<ApiSuccessResponse> {
    const user = await this.usersRepository.findUserCredentialsById(
      command.userId,
    );

    if (!user) {
      throwUserNotFoundException();
    }

    await assertCurrentPassword(command.dto.currentPassword, user.password);

    await this.usersRepository.updatePassword({
      userId: user.id,
      password: await hashPassword(command.dto.password),
    });

    return apiSuccess();
  }
}

async function assertCurrentPassword(
  currentPassword: string,
  passwordHash: string,
): Promise<void> {
  if (await verifyPassword(currentPassword, passwordHash)) {
    return;
  }

  throw new UnauthorizedException(
    apiError({
      code: USERS_ERROR_CODES.invalidCurrentPassword,
      message: 'Current password is invalid.',
    }),
  );
}

function throwUserNotFoundException(): never {
  throw new NotFoundException(
    apiError({
      code: USERS_ERROR_CODES.userNotFound,
      message: 'User was not found.',
    }),
  );
}

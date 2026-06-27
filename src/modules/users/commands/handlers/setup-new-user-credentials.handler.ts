import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { UserStatus } from '@generated/prisma/enums';

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
import { SetupNewUserCredentialsCommand } from '../impl/setup-new-user-credentials.command';

@CommandHandler(SetupNewUserCredentialsCommand)
export class SetupNewUserCredentialsHandler implements ICommandHandler<
  SetupNewUserCredentialsCommand,
  ApiSuccessResponse
> {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(
    command: SetupNewUserCredentialsCommand,
  ): Promise<ApiSuccessResponse> {
    const user = await this.usersRepository.findUserCredentialsById(
      command.userId,
    );

    if (!user) {
      throwUserNotFoundException();
    }

    if (user.status !== UserStatus.new) {
      throw new BadRequestException(
        apiError({
          code: USERS_ERROR_CODES.accountSetupUnavailable,
          message: 'Account setup is available only for new users.',
        }),
      );
    }

    await assertCurrentPassword(command.dto.currentPassword, user.password);

    await this.usersRepository.setupNewUserCredentials({
      userId: user.id,
      password: await hashPassword(command.dto.password),
      pin: await hashPassword(command.dto.pin),
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

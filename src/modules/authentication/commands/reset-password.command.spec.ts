import { BadRequestException } from '@nestjs/common';
import { UserStatus } from '@generated/prisma/enums';

import { hashPassword } from '../../../common/security/password/password';
import { AUTH_ERROR_CODES } from '../authentication.constants';
import { AuthenticationMailType } from '../mails/authentication-mail-type.enum';
import { ResetPasswordCommand } from './reset-password.command';

jest.mock('../../../common/security/password/password', () => ({
  hashPassword: jest.fn(),
}));
jest.mock('../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

const hashPasswordMock = jest.mocked(hashPassword);

describe('ResetPasswordCommand', () => {
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let tokenService: {
    verifyToken: jest.Mock;
  };
  let configService: {
    getOrThrow: jest.Mock;
  };
  let mailQueueService: {
    queueEmail: jest.Mock;
  };
  let accountStatusService: {
    throwIfBlocked: jest.Mock;
  };
  let command: ResetPasswordCommand;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    tokenService = {
      verifyToken: jest.fn(),
    };
    configService = {
      getOrThrow: jest.fn().mockReturnValue(3),
    };
    mailQueueService = {
      queueEmail: jest.fn().mockResolvedValue('task-name'),
    };
    accountStatusService = {
      throwIfBlocked: jest.fn().mockResolvedValue(undefined),
    };
    command = new ResetPasswordCommand(
      prisma as unknown as ConstructorParameters<
        typeof ResetPasswordCommand
      >[0],
      tokenService as unknown as ConstructorParameters<
        typeof ResetPasswordCommand
      >[1],
      configService as unknown as ConstructorParameters<
        typeof ResetPasswordCommand
      >[2],
      mailQueueService as unknown as ConstructorParameters<
        typeof ResetPasswordCommand
      >[3],
      accountStatusService as unknown as ConstructorParameters<
        typeof ResetPasswordCommand
      >[4],
    );

    hashPasswordMock.mockReset();
    hashPasswordMock.mockResolvedValue('new-password-hash');
  });

  it('throws bad request when reset code is missing', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      status: UserStatus.active,
      accountUnlockCodeHash: null,
      passwordResetCodeHash: null,
      passwordResetCodeValidTo: futureDate(),
      passwordResetIncorrectCounter: 0,
    });

    await expectInvalidPasswordResetCode(
      command.execute(createDto()),
    );

    expect(tokenService.verifyToken).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws bad request when reset code is expired', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      status: UserStatus.active,
      accountUnlockCodeHash: null,
      passwordResetCodeHash: 'reset-code-hash',
      passwordResetCodeValidTo: pastDate(),
      passwordResetIncorrectCounter: 0,
    });

    await expectInvalidPasswordResetCode(command.execute(createDto()));

    expect(tokenService.verifyToken).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('increments reset counter when reset code is invalid before retry limit', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      status: UserStatus.active,
      accountUnlockCodeHash: null,
      passwordResetCodeHash: 'reset-code-hash',
      passwordResetCodeValidTo: futureDate(),
      passwordResetIncorrectCounter: 1,
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-id',
      accountUnlockCodeHash: null,
      passwordResetIncorrectCounter: 2,
    });
    tokenService.verifyToken.mockResolvedValue(false);

    await expectInvalidPasswordResetCode(command.execute(createDto()));

    expect(tokenService.verifyToken).toHaveBeenCalledWith(
      'reset-code',
      'reset-code-hash',
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
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
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(mailQueueService.queueEmail).not.toHaveBeenCalled();
  });

  it('blocks user and queues unlock email when invalid reset code reaches retry limit', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      status: UserStatus.active,
      accountUnlockCodeHash: null,
      passwordResetCodeHash: 'reset-code-hash',
      passwordResetCodeValidTo: futureDate(),
      passwordResetIncorrectCounter: 2,
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-id',
      accountUnlockCodeHash: null,
      passwordResetIncorrectCounter: 3,
    });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    tokenService.verifyToken.mockResolvedValue(false);

    await expectInvalidPasswordResetCode(command.execute(createDto()));

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'user-id',
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
    expect(mailQueueService.queueEmail).toHaveBeenCalledWith({
      userId: 'user-id',
      type: AuthenticationMailType.ACCOUNT_UNLOCK,
    });
  });

  it('does not queue unlock email when concurrent request already blocked user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      status: UserStatus.active,
      accountUnlockCodeHash: null,
      passwordResetCodeHash: 'reset-code-hash',
      passwordResetCodeValidTo: futureDate(),
      passwordResetIncorrectCounter: 2,
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-id',
      accountUnlockCodeHash: null,
      passwordResetIncorrectCounter: 3,
    });
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    tokenService.verifyToken.mockResolvedValue(false);

    await expectInvalidPasswordResetCode(command.execute(createDto()));

    expect(mailQueueService.queueEmail).not.toHaveBeenCalled();
  });

  it('updates password and clears authentication state when reset code is valid', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      status: UserStatus.active,
      accountUnlockCodeHash: null,
      passwordResetCodeHash: 'reset-code-hash',
      passwordResetCodeValidTo: futureDate(),
      passwordResetIncorrectCounter: 1,
    });
    tokenService.verifyToken.mockResolvedValue(true);

    await expect(command.execute(createDto())).resolves.toEqual({
      success: true,
      data: null,
    });

    expect(hashPasswordMock).toHaveBeenCalledWith('NewPassword1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: {
        password: 'new-password-hash',
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
  });
});

function createDto() {
  return {
    userId: 'user-id',
    code: 'reset-code',
    password: 'NewPassword1',
  };
}

function futureDate(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

function pastDate(): Date {
  return new Date(Date.now() - 60 * 60 * 1000);
}

async function expectInvalidPasswordResetCode(
  promise: Promise<unknown>,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  await expect(promise).rejects.toMatchObject({
    response: {
      success: false,
      error: {
        code: AUTH_ERROR_CODES.invalidPasswordResetCode,
        message: 'Password reset code is invalid or expired.',
        details: null,
      },
    },
  });
}

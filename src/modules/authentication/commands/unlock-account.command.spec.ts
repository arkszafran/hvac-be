import { BadRequestException } from '@nestjs/common';
import { UserStatus } from '@generated/prisma/enums';

import { AUTH_ERROR_CODES } from '../authentication.constants';
import { UnlockAccountCommand } from './unlock-account.command';

jest.mock('../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('UnlockAccountCommand', () => {
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let tokenService: {
    verifyToken: jest.Mock;
  };
  let configService: {
    getOrThrow: jest.Mock;
  };
  let command: UnlockAccountCommand;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    tokenService = {
      verifyToken: jest.fn(),
    };
    configService = {
      getOrThrow: jest.fn().mockReturnValue(5),
    };
    command = new UnlockAccountCommand(
      prisma as unknown as ConstructorParameters<
        typeof UnlockAccountCommand
      >[0],
      tokenService as unknown as ConstructorParameters<
        typeof UnlockAccountCommand
      >[1],
      configService as unknown as ConstructorParameters<
        typeof UnlockAccountCommand
      >[2],
    );
  });

  it('throws bad request when unlock code hash does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      accountUnlockCodeHash: null,
      accountUnlockCodeValidTo: futureDate(),
      accountUnlockIncorrectCounter: 0,
    });

    await expectInvalidUnlockCode(
      command.execute({
        userId: 'user-id',
        code: 'unlock-code',
      }),
    );

    expect(tokenService.verifyToken).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws bad request when unlock code is expired', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      accountUnlockCodeHash: 'unlock-code-hash',
      accountUnlockCodeValidTo: pastDate(),
      accountUnlockIncorrectCounter: 0,
    });

    await expectAccountUnlockCodeExpired(
      command.execute({
        userId: 'user-id',
        code: 'unlock-code',
      }),
    );

    expect(tokenService.verifyToken).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws bad request when unlock attempts limit is already reached', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      accountUnlockCodeHash: 'unlock-code-hash',
      accountUnlockCodeValidTo: futureDate(),
      accountUnlockIncorrectCounter: 5,
    });

    await expectAccountUnlockRetriesLimitReached(
      command.execute({
        userId: 'user-id',
        code: 'unlock-code',
      }),
    );

    expect(tokenService.verifyToken).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws bad request when unlock code is invalid', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      accountUnlockCodeHash: 'unlock-code-hash',
      accountUnlockCodeValidTo: futureDate(),
      accountUnlockIncorrectCounter: 1,
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-id',
      accountUnlockIncorrectCounter: 2,
    });
    tokenService.verifyToken.mockResolvedValue(false);

    await expectInvalidUnlockCode(
      command.execute({
        userId: 'user-id',
        code: 'unlock-code',
      }),
    );

    expect(tokenService.verifyToken).toHaveBeenCalledWith(
      'unlock-code',
      'unlock-code-hash',
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: {
        accountUnlockIncorrectCounter: {
          increment: 1,
        },
      },
      select: {
        id: true,
        accountUnlockIncorrectCounter: true,
      },
    });
  });

  it('invalidates unlock link when invalid code reaches retry limit', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      accountUnlockCodeHash: 'unlock-code-hash',
      accountUnlockCodeValidTo: futureDate(),
      accountUnlockIncorrectCounter: 4,
    });
    prisma.user.update.mockResolvedValueOnce({
      id: 'user-id',
      accountUnlockIncorrectCounter: 5,
    });
    tokenService.verifyToken.mockResolvedValue(false);

    await expectAccountUnlockRetriesLimitReached(
      command.execute({
        userId: 'user-id',
        code: 'unlock-code',
      }),
    );

    expect(prisma.user.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'user-id' },
      data: {
        accountUnlockCodeHash: null,
        accountUnlockCodeValidTo: null,
      },
    });
  });

  it('activates user and resets authentication state when unlock code is valid', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      accountUnlockCodeHash: 'unlock-code-hash',
      accountUnlockCodeValidTo: futureDate(),
      accountUnlockIncorrectCounter: 1,
    });
    tokenService.verifyToken.mockResolvedValue(true);

    await expect(
      command.execute({
        userId: 'user-id',
        code: 'unlock-code',
      }),
    ).resolves.toEqual({ success: true, data: null });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: {
        status: UserStatus.active,
        incorrectLoginCounter: 0,
        incorrectPINCounter: 0,
        refreshTokenHash: null,
        refreshTokenValidTo: null,
        accountUnlockCodeHash: null,
        accountUnlockCodeValidTo: null,
        accountUnlockIncorrectCounter: 0,
      },
    });
  });
});

async function expectInvalidUnlockCode(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  await expect(promise).rejects.toMatchObject({
    response: {
      success: false,
      error: {
        code: AUTH_ERROR_CODES.invalidAccountUnlockCode,
        message: 'Account unlock code is invalid.',
        details: null,
      },
    },
  });
}

async function expectAccountUnlockCodeExpired(
  promise: Promise<unknown>,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  await expect(promise).rejects.toMatchObject({
    response: {
      success: false,
      error: {
        code: AUTH_ERROR_CODES.accountUnlockCodeExpired,
        message: 'Account unlock code is expired.',
        details: null,
      },
    },
  });
}

async function expectAccountUnlockRetriesLimitReached(
  promise: Promise<unknown>,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  await expect(promise).rejects.toMatchObject({
    response: {
      success: false,
      error: {
        code: AUTH_ERROR_CODES.accountUnlockCodeRetriesLimitReached,
        message: 'Account unlock code retries limit reached.',
        details: null,
      },
    },
  });
}

function futureDate(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

function pastDate(): Date {
  return new Date(Date.now() - 60 * 60 * 1000);
}

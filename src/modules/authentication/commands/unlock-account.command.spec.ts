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
    command = new UnlockAccountCommand(
      prisma as unknown as ConstructorParameters<
        typeof UnlockAccountCommand
      >[0],
      tokenService as unknown as ConstructorParameters<
        typeof UnlockAccountCommand
      >[1],
    );
  });

  it('throws bad request when unlock code hash does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      accountUnlockCodeHash: null,
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

  it('throws bad request when unlock code is invalid', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      accountUnlockCodeHash: 'unlock-code-hash',
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
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('activates user and resets authentication state when unlock code is valid', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      accountUnlockCodeHash: 'unlock-code-hash',
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

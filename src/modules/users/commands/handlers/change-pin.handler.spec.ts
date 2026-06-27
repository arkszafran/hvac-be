import { UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@generated/prisma/enums';

import {
  hashPassword,
  verifyPassword,
} from '../../../../common/security/password/password';
import { ChangePinCommand } from '../impl/change-pin.command';
import { ChangePinHandler } from './change-pin.handler';

jest.mock('../../../../common/security/password/password', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));
jest.mock('../../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

const hashPasswordMock = jest.mocked(hashPassword);
const verifyPasswordMock = jest.mocked(verifyPassword);

describe('ChangePinHandler', () => {
  let usersRepository: {
    findUserCredentialsById: jest.Mock;
    updatePin: jest.Mock;
  };
  let handler: ChangePinHandler;

  beforeEach(() => {
    usersRepository = {
      findUserCredentialsById: jest.fn(),
      updatePin: jest.fn(),
    };
    handler = new ChangePinHandler(
      usersRepository as unknown as ConstructorParameters<
        typeof ChangePinHandler
      >[0],
    );

    verifyPasswordMock.mockReset().mockResolvedValue(true);
    hashPasswordMock.mockReset().mockResolvedValue('pin-hash');
  });

  it('changes pin when current password is valid', async () => {
    usersRepository.findUserCredentialsById.mockResolvedValue({
      id: 'user-id',
      password: 'current-password-hash',
      status: UserStatus.active,
    });

    await expect(
      handler.execute(
        new ChangePinCommand('user-id', {
          currentPassword: 'CurrentPassword1',
          pin: '1234',
        }),
      ),
    ).resolves.toEqual({ success: true, data: null });

    expect(usersRepository.updatePin).toHaveBeenCalledWith({
      userId: 'user-id',
      pin: 'pin-hash',
    });
  });

  it('rejects invalid current password', async () => {
    usersRepository.findUserCredentialsById.mockResolvedValue({
      id: 'user-id',
      password: 'current-password-hash',
      status: UserStatus.active,
    });
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      handler.execute(
        new ChangePinCommand('user-id', {
          currentPassword: 'wrong-password',
          pin: '1234',
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

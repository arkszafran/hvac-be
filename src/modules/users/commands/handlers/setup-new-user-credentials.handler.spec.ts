import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@generated/prisma/enums';

import {
  hashPassword,
  verifyPassword,
} from '../../../../common/security/password/password';
import { SetupNewUserCredentialsCommand } from '../impl/setup-new-user-credentials.command';
import { SetupNewUserCredentialsHandler } from './setup-new-user-credentials.handler';

jest.mock('../../../../common/security/password/password', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));
jest.mock('../../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

const hashPasswordMock = jest.mocked(hashPassword);
const verifyPasswordMock = jest.mocked(verifyPassword);

describe('SetupNewUserCredentialsHandler', () => {
  let usersRepository: {
    findUserCredentialsById: jest.Mock;
    setupNewUserCredentials: jest.Mock;
  };
  let handler: SetupNewUserCredentialsHandler;

  beforeEach(() => {
    usersRepository = {
      findUserCredentialsById: jest.fn(),
      setupNewUserCredentials: jest.fn(),
    };
    handler = new SetupNewUserCredentialsHandler(
      usersRepository as unknown as ConstructorParameters<
        typeof SetupNewUserCredentialsHandler
      >[0],
    );

    verifyPasswordMock.mockReset().mockResolvedValue(true);
    hashPasswordMock
      .mockReset()
      .mockResolvedValueOnce('new-password-hash')
      .mockResolvedValueOnce('pin-hash');
  });

  it('sets password, pin and activates a new user', async () => {
    usersRepository.findUserCredentialsById.mockResolvedValue({
      id: 'user-id',
      password: 'temporary-password-hash',
      status: UserStatus.new,
    });

    await expect(
      handler.execute(
        new SetupNewUserCredentialsCommand('user-id', createDto()),
      ),
    ).resolves.toEqual({ success: true, data: null });

    expect(verifyPasswordMock).toHaveBeenCalledWith(
      'temporary-password',
      'temporary-password-hash',
    );
    expect(usersRepository.setupNewUserCredentials).toHaveBeenCalledWith({
      userId: 'user-id',
      password: 'new-password-hash',
      pin: 'pin-hash',
    });
  });

  it('rejects active users', async () => {
    usersRepository.findUserCredentialsById.mockResolvedValue({
      id: 'user-id',
      password: 'password-hash',
      status: UserStatus.active,
    });

    await expect(
      handler.execute(
        new SetupNewUserCredentialsCommand('user-id', createDto()),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid temporary password', async () => {
    usersRepository.findUserCredentialsById.mockResolvedValue({
      id: 'user-id',
      password: 'temporary-password-hash',
      status: UserStatus.new,
    });
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      handler.execute(
        new SetupNewUserCredentialsCommand('user-id', createDto()),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function createDto() {
  return {
    currentPassword: 'temporary-password',
    password: 'NewPassword1',
    pin: '1234',
  };
}

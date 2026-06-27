import { UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@generated/prisma/enums';

import {
  hashPassword,
  verifyPassword,
} from '../../../../common/security/password/password';
import { ChangePasswordCommand } from '../impl/change-password.command';
import { ChangePasswordHandler } from './change-password.handler';

jest.mock('../../../../common/security/password/password', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));
jest.mock('../../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

const hashPasswordMock = jest.mocked(hashPassword);
const verifyPasswordMock = jest.mocked(verifyPassword);

describe('ChangePasswordHandler', () => {
  let usersRepository: {
    findUserCredentialsById: jest.Mock;
    updatePassword: jest.Mock;
  };
  let handler: ChangePasswordHandler;

  beforeEach(() => {
    usersRepository = {
      findUserCredentialsById: jest.fn(),
      updatePassword: jest.fn(),
    };
    handler = new ChangePasswordHandler(
      usersRepository as unknown as ConstructorParameters<
        typeof ChangePasswordHandler
      >[0],
    );

    verifyPasswordMock.mockReset().mockResolvedValue(true);
    hashPasswordMock.mockReset().mockResolvedValue('new-password-hash');
  });

  it('changes password when current password is valid', async () => {
    usersRepository.findUserCredentialsById.mockResolvedValue({
      id: 'user-id',
      password: 'current-password-hash',
      status: UserStatus.active,
    });

    await expect(
      handler.execute(
        new ChangePasswordCommand('user-id', {
          currentPassword: 'CurrentPassword1',
          password: 'NewPassword1',
        }),
      ),
    ).resolves.toEqual({ success: true, data: null });

    expect(usersRepository.updatePassword).toHaveBeenCalledWith({
      userId: 'user-id',
      password: 'new-password-hash',
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
        new ChangePasswordCommand('user-id', {
          currentPassword: 'wrong-password',
          password: 'NewPassword1',
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

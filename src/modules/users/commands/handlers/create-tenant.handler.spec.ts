import { ConflictException } from '@nestjs/common';

import {
  generateTemporaryPassword,
  hashPassword,
} from '../../../../common/security/password/password';
import { USERS_ERROR_CODES } from '../../users.constants';
import { CreateTenantCommand } from '../impl/create-tenant.command';
import { CreateTenantHandler } from './create-tenant.handler';

jest.mock('../../../../common/security/password/password', () => ({
  generateTemporaryPassword: jest.fn(),
  hashPassword: jest.fn(),
}));
jest.mock('../../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

const generateTemporaryPasswordMock = jest.mocked(generateTemporaryPassword);
const hashPasswordMock = jest.mocked(hashPassword);

describe('CreateTenantHandler', () => {
  let usersRepository: {
    hasUserWithEmail: jest.Mock;
    createTenantWithFirstUser: jest.Mock;
  };
  let mailQueueService: {
    queueTenantUserCreatedEmail: jest.Mock;
  };
  let handler: CreateTenantHandler;

  beforeEach(() => {
    usersRepository = {
      hasUserWithEmail: jest.fn(),
      createTenantWithFirstUser: jest.fn(),
    };
    mailQueueService = {
      queueTenantUserCreatedEmail: jest.fn(),
    };
    handler = new CreateTenantHandler(
      usersRepository as unknown as ConstructorParameters<
        typeof CreateTenantHandler
      >[0],
      mailQueueService as unknown as ConstructorParameters<
        typeof CreateTenantHandler
      >[1],
    );

    generateTemporaryPasswordMock.mockReset().mockReturnValue('temporary-pass');
    hashPasswordMock.mockReset().mockResolvedValue('hashed-temporary-pass');
  });

  it('creates tenant, first user and queues welcome email', async () => {
    usersRepository.hasUserWithEmail.mockResolvedValue(false);
    usersRepository.createTenantWithFirstUser.mockResolvedValue({
      tenantId: 'tenant-id',
      userId: 'user-id',
    });

    await expect(
      handler.execute(new CreateTenantCommand(createDto())),
    ).resolves.toEqual({
      success: true,
      data: {
        tenantId: 'tenant-id',
        userId: 'user-id',
      },
    });

    expect(usersRepository.createTenantWithFirstUser).toHaveBeenCalledWith({
      tenant: {
        name: 'Tenant',
        personName: 'Owner',
        street: 'Street 1',
        city: 'City',
        zip: '00-001',
        tax: '1234567890',
      },
      user: {
        name: 'User',
        email: 'user@example.com',
        password: 'hashed-temporary-pass',
      },
    });
    expect(mailQueueService.queueTenantUserCreatedEmail).toHaveBeenCalledWith({
      userId: 'user-id',
      temporaryPassword: 'temporary-pass',
    });
  });

  it('throws conflict when email already exists', async () => {
    usersRepository.hasUserWithEmail.mockResolvedValue(true);

    const result = handler.execute(new CreateTenantCommand(createDto()));

    await expect(result).rejects.toMatchObject({
      response: {
        error: {
          code: USERS_ERROR_CODES.emailAlreadyExists,
        },
      },
    });
    await expect(result).rejects.toBeInstanceOf(ConflictException);
  });
});

function createDto() {
  return {
    tenant: {
      name: 'Tenant',
      personName: 'Owner',
      street: 'Street 1',
      city: 'City',
      zip: '00-001',
      tax: '1234567890',
    },
    user: {
      name: 'User',
      email: 'USER@example.com',
    },
  };
}

import {
  generateTemporaryPassword,
  hashPassword,
} from '../../../../common/security/password/password';
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
    findUserIdByEmail: jest.Mock;
    createTenantWithAdminUser: jest.Mock;
  };
  let mailQueueService: {
    queueTenantUserCreatedEmail: jest.Mock;
  };
  let tenantKeyService: {
    prepareInitialKey: jest.Mock;
  };
  let preparedTenantId: string | undefined;
  let handler: CreateTenantHandler;

  beforeEach(() => {
    usersRepository = {
      findUserIdByEmail: jest.fn(),
      createTenantWithAdminUser: jest.fn(),
    };
    mailQueueService = {
      queueTenantUserCreatedEmail: jest.fn(),
    };
    tenantKeyService = {
      prepareInitialKey: jest.fn().mockImplementation((tenantId: string) => {
        preparedTenantId = tenantId;

        return {
          tenantId,
          version: 1,
          wrappedDek: Buffer.from('wrapped-dek'),
          kekKeyName: 'kms-key',
          kekKeyVersion: 'kms-key/cryptoKeyVersions/1',
        };
      }),
    };
    handler = new CreateTenantHandler(
      usersRepository as unknown as ConstructorParameters<
        typeof CreateTenantHandler
      >[0],
      tenantKeyService as unknown as ConstructorParameters<
        typeof CreateTenantHandler
      >[1],
      mailQueueService as unknown as ConstructorParameters<
        typeof CreateTenantHandler
      >[2],
    );

    generateTemporaryPasswordMock.mockReset().mockReturnValue('temporary-pass');
    hashPasswordMock.mockReset().mockResolvedValue('hashed-temporary-pass');
  });

  it('creates tenant, first user and queues welcome email', async () => {
    usersRepository.findUserIdByEmail.mockResolvedValue(null);
    usersRepository.createTenantWithAdminUser.mockResolvedValue({
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

    expect(preparedTenantId).toEqual(expect.any(String));
    expect(usersRepository.findUserIdByEmail).toHaveBeenCalledWith(
      'user@example.com',
    );
    expect(usersRepository.createTenantWithAdminUser).toHaveBeenCalledWith({
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
      encryptionKey: {
        tenantId: preparedTenantId,
        version: 1,
        wrappedDek: Buffer.from('wrapped-dek'),
        kekKeyName: 'kms-key',
        kekKeyVersion: 'kms-key/cryptoKeyVersions/1',
      },
    });
    expect(mailQueueService.queueTenantUserCreatedEmail).toHaveBeenCalledWith({
      userId: 'user-id',
      temporaryPassword: 'temporary-pass',
    });
  });

  it('links an existing user to the new tenant without changing credentials', async () => {
    usersRepository.findUserIdByEmail.mockResolvedValue('existing-user-id');
    usersRepository.createTenantWithAdminUser.mockResolvedValue({
      tenantId: 'tenant-id',
      userId: 'existing-user-id',
    });

    await expect(
      handler.execute(new CreateTenantCommand(createDto())),
    ).resolves.toEqual({
      success: true,
      data: {
        tenantId: 'tenant-id',
        userId: 'existing-user-id',
      },
    });

    expect(usersRepository.findUserIdByEmail).toHaveBeenCalledWith(
      'user@example.com',
    );
    expect(usersRepository.createTenantWithAdminUser).toHaveBeenCalledWith({
      tenant: {
        name: 'Tenant',
        personName: 'Owner',
        street: 'Street 1',
        city: 'City',
        zip: '00-001',
        tax: '1234567890',
      },
      user: {
        existingUserId: 'existing-user-id',
      },
      encryptionKey: {
        tenantId: preparedTenantId,
        version: 1,
        wrappedDek: Buffer.from('wrapped-dek'),
        kekKeyName: 'kms-key',
        kekKeyVersion: 'kms-key/cryptoKeyVersions/1',
      },
    });
    expect(generateTemporaryPasswordMock).not.toHaveBeenCalled();
    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(mailQueueService.queueTenantUserCreatedEmail).not.toHaveBeenCalled();
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

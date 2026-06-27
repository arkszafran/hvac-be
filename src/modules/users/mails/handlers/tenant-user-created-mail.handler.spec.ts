import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MailService } from '../../../../common/mail/mail.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { TenantUserCreatedMailHandler } from './tenant-user-created-mail.handler';

jest.mock('../../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('TenantUserCreatedMailHandler', () => {
  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
  };
  let mailService: {
    sendEmail: jest.Mock;
  };
  let configService: {
    getOrThrow: jest.Mock;
  };
  let handler: TenantUserCreatedMailHandler;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };
    mailService = {
      sendEmail: jest.fn(),
    };
    configService = {
      getOrThrow: jest.fn().mockReturnValue('https://tenant.example.com/'),
    };
    handler = new TenantUserCreatedMailHandler(
      prisma as unknown as PrismaService,
      mailService as unknown as MailService,
      configService as unknown as ConfigService,
    );
  });

  it('sends setup email with base64 encoded email and password in setup url', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      name: 'User',
    });

    await handler.handle({
      userId: 'user-id',
      temporaryPassword: 'Temp+Password/1=',
    });

    const setupUrl = mailService.sendEmail.mock.calls[0][0].templateVariables
      .setupUrl as string;
    const params = new URLSearchParams(setupUrl.split('#')[1]);

    expect(setupUrl).toBe(
      'https://tenant.example.com/account-setup#email=dXNlckBleGFtcGxlLmNvbQ%3D%3D&password=VGVtcCtQYXNzd29yZC8xPQ%3D%3D',
    );
    expect(params.get('email')).toBe(
      Buffer.from('user@example.com', 'utf8').toString('base64'),
    );
    expect(params.get('password')).toBe(
      Buffer.from('Temp+Password/1=', 'utf8').toString('base64'),
    );
  });

  it('throws when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.handle({
        userId: 'missing-user-id',
        temporaryPassword: 'temporary-password',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mailService.sendEmail).not.toHaveBeenCalled();
  });
});

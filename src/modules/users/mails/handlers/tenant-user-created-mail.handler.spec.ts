import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MailService } from '../../../../common/mail/mail.service';
import type { SendEmailInput } from '../../../../common/mail/mail.types';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { TenantUserCreatedMailHandler } from './tenant-user-created-mail.handler';

jest.mock('../../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('TenantUserCreatedMailHandler', () => {
  type SendEmailMock = jest.MockedFunction<
    (input: SendEmailInput) => Promise<void>
  >;

  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
  };
  let mailService: {
    sendEmail: SendEmailMock;
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
      sendEmail: jest.fn<(input: SendEmailInput) => Promise<void>>(),
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

  it('sends setup email with base64url encoded auto-login payload in setup url', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      name: 'User',
    });

    await handler.handle({
      userId: 'user-id',
      temporaryPassword: 'Temp+Password/1=',
    });

    const payload = Buffer.from(
      JSON.stringify({
        email: 'user@example.com',
        password: 'Temp+Password/1=',
      }),
      'utf8',
    ).toString('base64url');

    const sendEmailInput = mailService.sendEmail.mock.calls[0]?.[0];

    expect(sendEmailInput?.templateVariables?.setupUrl).toBe(
      `https://tenant.example.com/auto-login#${payload}`,
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

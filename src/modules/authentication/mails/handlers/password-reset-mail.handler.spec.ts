import { Buffer } from 'node:buffer';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MailService } from '../../../../common/mail/mail.service';
import type { SendEmailInput } from '../../../../common/mail/mail.types';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuthenticationTokenService } from '../../authentication-token.service';
import { PasswordResetMailHandler } from './password-reset-mail.handler';

jest.mock('../../../../common/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('PasswordResetMailHandler', () => {
  type User = {
    readonly id: string;
    readonly email: string;
    readonly name: string;
  };
  type SendEmailMock = jest.MockedFunction<
    (input: SendEmailInput) => Promise<void>
  >;

  let prisma: {
    user: {
      findUnique: jest.MockedFunction<(input: unknown) => Promise<User | null>>;
      update: jest.MockedFunction<(input: unknown) => Promise<User>>;
    };
  };
  let mailService: {
    sendEmail: SendEmailMock;
  };
  let configService: {
    getOrThrow: jest.MockedFunction<(key: string) => string>;
  };
  let tokenService: {
    hashToken: jest.MockedFunction<(token: string) => Promise<string>>;
  };
  let handler: PasswordResetMailHandler;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn<(input: unknown) => Promise<User | null>>(),
        update: jest.fn<(input: unknown) => Promise<User>>(),
      },
    };
    mailService = {
      sendEmail: jest.fn<(input: SendEmailInput) => Promise<void>>(),
    };
    configService = {
      getOrThrow: jest
        .fn<(key: string) => string>()
        .mockImplementation((key) => {
          if (key === 'FRONTEND_TENANT_ORIGIN') {
            return 'https://tenant.example.com/';
          }

          if (key === 'PASSWORD_RESET_CODE_TTL_MINUTES') {
            return '15';
          }

          throw new Error(`Unexpected config key: ${key}`);
        }),
    };
    tokenService = {
      hashToken: jest
        .fn<(token: string) => Promise<string>>()
        .mockResolvedValue('hashed-reset-code'),
    };
    handler = new PasswordResetMailHandler(
      prisma as unknown as PrismaService,
      mailService as unknown as MailService,
      configService as unknown as ConfigService,
      tokenService as unknown as AuthenticationTokenService,
    );
  });

  it('sends reset email with base64url encoded reset payload in reset url', async () => {
    const user = {
      id: 'user-id',
      email: 'user@example.com',
      name: 'User',
    };
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);

    await handler.handle('user-id');

    const code = tokenService.hashToken.mock.calls[0]?.[0];

    if (!code) {
      throw new Error('Reset code was not generated.');
    }

    const payload = Buffer.from(
      JSON.stringify({ code, userId: 'user-id' }),
      'utf8',
    ).toString('base64url');
    const sendEmailInput = mailService.sendEmail.mock.calls[0]?.[0];

    expect(sendEmailInput?.templateVariables?.resetUrl).toBe(
      `https://tenant.example.com/password-reset#${payload}`,
    );
    expect(sendEmailInput?.templateVariables?.validMinutes).toBe(15);
  });

  it('throws when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(handler.handle('missing-user-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(mailService.sendEmail).not.toHaveBeenCalled();
  });
});

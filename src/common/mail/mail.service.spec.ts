import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
  },
}));

describe('MailService', () => {
  const env: Record<string, string> = {
    SMTP_URL: 'smtp://smtp.example.com:587',
    SMTP_USER: 'smtp-user',
    SMTP_PASSWORD: 'smtp-password',
    SMTP_FROM_ADDRESS: 'no-reply@example.com',
    SMTP_FROM_NAME: 'HVAC',
    SMTP_REQUIRE_TLS: 'true',
    SMTP_REJECT_UNAUTHORIZED: 'true',
    SMTP_MAX_CONNECTIONS: '5',
    SMTP_MAX_MESSAGES: '100',
    SMTP_CONNECTION_TIMEOUT_MS: '10000',
    SMTP_GREETING_TIMEOUT_MS: '10000',
    SMTP_SOCKET_TIMEOUT_MS: '30000',
  };

  let sendMailMock: jest.Mock;
  let service: MailService;

  beforeEach(() => {
    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'message-id' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });

    service = new MailService(createConfigService());
  });

  it('creates SMTP transporter from env configuration', () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'smtp-user',
          pass: 'smtp-password',
        },
        requireTLS: true,
        pool: true,
      }),
    );
  });

  it('renders and sends inline Handlebars template', async () => {
    await service.sendEmail({
      recipients: 'user@example.com',
      subject: 'Welcome',
      template: '<p>Hello {{name}}</p>',
      templateVariables: {
        name: 'Ada',
      },
    });

    expect(sendMailMock).toHaveBeenCalledWith({
      from: {
        address: 'no-reply@example.com',
        name: 'HVAC',
      },
      to: ['user@example.com'],
      subject: 'Welcome',
      html: '<p>Hello Ada</p>',
    });
  });

  it('uses inline template when both inline template and file path are provided', async () => {
    const directoryPath = await mkdtemp(join(tmpdir(), 'mail-service-'));
    const templatePath = join(directoryPath, 'template.hbs');

    try {
      await writeFile(templatePath, '<p>From file {{name}}</p>');

      await service.sendEmail({
        recipients: 'user@example.com',
        subject: 'Welcome',
        templateFilePath: templatePath,
        template: '<p>Inline {{name}}</p>',
        templateVariables: {
          name: 'Ada',
        },
      });

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<p>Inline Ada</p>',
        }),
      );
    } finally {
      await rm(directoryPath, { recursive: true, force: true });
    }
  });

  it('reads and renders Handlebars template from file path', async () => {
    const directoryPath = await mkdtemp(join(tmpdir(), 'mail-service-'));
    const templatePath = join(directoryPath, 'template.hbs');

    try {
      await writeFile(templatePath, '<p>From file {{name}}</p>');

      await service.sendEmail({
        recipients: ['user@example.com', 'admin@example.com'],
        subject: 'Welcome',
        templateFilePath: templatePath,
        templateVariables: {
          name: 'Ada',
        },
      });

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user@example.com', 'admin@example.com'],
          html: '<p>From file Ada</p>',
        }),
      );
    } finally {
      await rm(directoryPath, { recursive: true, force: true });
    }
  });

  it('throws when template and template file path are missing', async () => {
    await expect(
      service.sendEmail({
        recipients: 'user@example.com',
        subject: 'Welcome',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(sendMailMock).not.toHaveBeenCalled();
  });

  function createConfigService(): ConfigService {
    return {
      get: jest.fn((key: string) => env[key]),
      getOrThrow: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService;
  }
});

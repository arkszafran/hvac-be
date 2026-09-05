import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

export type CustomerEmailLookup = {
  readonly hash: Buffer;
  readonly keyVersion: number;
};

@Injectable()
export class CustomerEmailLookupService implements OnModuleDestroy {
  private readonly secret: Buffer;
  private readonly keyVersion: number;

  constructor(configService: ConfigService) {
    this.secret = Buffer.from(
      configService.getOrThrow<string>(
        'CUSTOMER_EMAIL_LOOKUP_HMAC_SECRET_BASE64',
      ),
      'base64',
    );
    this.keyVersion = Number(
      configService.getOrThrow<string | number>(
        'CUSTOMER_EMAIL_LOOKUP_HMAC_KEY_VERSION',
      ),
    );
  }

  create(tenantId: string, email: string): CustomerEmailLookup {
    const normalizedEmail = normalizeCustomerEmail(email);

    return {
      hash: createHmac('sha256', this.secret)
        .update('customer-email-lookup\0', 'utf8')
        .update(tenantId, 'utf8')
        .update('\0', 'utf8')
        .update(normalizedEmail, 'utf8')
        .digest(),
      keyVersion: this.keyVersion,
    };
  }

  onModuleDestroy(): void {
    this.secret.fill(0);
  }
}

export function normalizeCustomerEmail(email: string): string {
  return email.trim().normalize('NFC').toLowerCase();
}

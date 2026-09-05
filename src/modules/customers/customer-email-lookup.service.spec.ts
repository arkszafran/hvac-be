import { ConfigService } from '@nestjs/config';

import { CustomerEmailLookupService } from './customer-email-lookup.service';

describe('CustomerEmailLookupService', () => {
  it('creates a normalized, deterministic 32-byte HMAC', () => {
    const config = new ConfigService({
      CUSTOMER_EMAIL_LOOKUP_HMAC_SECRET_BASE64:
        'CV8oaKgH0NJ8F6rd5SRe4hlO4IwPeDU2GcALUuWvT0Y=',
      CUSTOMER_EMAIL_LOOKUP_HMAC_KEY_VERSION: '3',
    });
    const service = new CustomerEmailLookupService(config);

    const first = service.create('tenant-1', '  Jan.Kowalski@Example.com ');
    const second = service.create('tenant-1', 'jan.kowalski@example.com');
    const otherTenant = service.create('tenant-2', 'jan.kowalski@example.com');

    expect(first.hash).toHaveLength(32);
    expect(first.hash).toEqual(second.hash);
    expect(first.hash).not.toEqual(otherTenant.hash);
    expect(first.keyVersion).toBe(3);

    service.onModuleDestroy();
  });
});

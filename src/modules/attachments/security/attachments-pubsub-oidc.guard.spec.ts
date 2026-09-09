import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AttachmentsPubSubOidcGuard } from './attachments-pubsub-oidc.guard';

describe('AttachmentsPubSubOidcGuard', () => {
  const verifier = { verify: jest.fn() };
  const guard = new AttachmentsPubSubOidcGuard(
    verifier as never,
    new ConfigService({
      ATTACHMENTS_PUBSUB_OIDC_AUDIENCE:
        'https://api.example.com/internal/pubsub/attachment-file-events',
      ATTACHMENTS_PUBSUB_OIDC_SERVICE_ACCOUNT_EMAIL:
        'push@example-project.iam.gserviceaccount.com',
    }),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    verifier.verify.mockResolvedValue(undefined);
  });

  it('verifies a bearer token against the configured identity', async () => {
    await expect(
      guard.canActivate(context('Bearer google-token')),
    ).resolves.toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith({
      token: 'google-token',
      audience:
        'https://api.example.com/internal/pubsub/attachment-file-events',
      serviceAccountEmail: 'push@example-project.iam.gserviceaccount.com',
    });
  });

  it.each([undefined, '', 'Basic token', 'Bearer', 'Bearer token extra'])(
    'rejects malformed authorization %s',
    async (authorization) => {
      await expect(
        guard.canActivate(context(authorization)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verifier.verify).not.toHaveBeenCalled();
    },
  );
});

function context(authorization: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as ExecutionContext;
}

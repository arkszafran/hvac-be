import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

import { GoogleOidcTokenVerifierService } from './google-oidc-token-verifier.service';

describe('GoogleOidcTokenVerifierService', () => {
  let verifyIdToken: jest.SpiedFunction<OAuth2Client['verifyIdToken']>;
  let service: GoogleOidcTokenVerifierService;

  beforeEach(() => {
    verifyIdToken = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken');
    service = new GoogleOidcTokenVerifierService();
  });

  afterEach(() => {
    verifyIdToken.mockRestore();
  });

  it('accepts a verified token for the expected service account', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'push@example-project.iam.gserviceaccount.com',
        email_verified: true,
      }),
    } as never);

    await expect(
      service.verify({
        token: 'google-token',
        audience: 'https://api.example.com/internal/pubsub/events',
        serviceAccountEmail: 'push@example-project.iam.gserviceaccount.com',
      }),
    ).resolves.toBeUndefined();
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'google-token',
      audience: 'https://api.example.com/internal/pubsub/events',
    });
  });

  it('rejects a token issued for another service account', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'different@example-project.iam.gserviceaccount.com',
        email_verified: true,
      }),
    } as never);

    await expect(
      service.verify({
        token: 'google-token',
        audience: 'https://api.example.com/internal/pubsub/events',
        serviceAccountEmail: 'push@example-project.iam.gserviceaccount.com',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unverified service-account email', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'push@example-project.iam.gserviceaccount.com',
        email_verified: false,
      }),
    } as never);

    await expect(
      service.verify({
        token: 'google-token',
        audience: 'https://api.example.com/internal/pubsub/events',
        serviceAccountEmail: 'push@example-project.iam.gserviceaccount.com',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

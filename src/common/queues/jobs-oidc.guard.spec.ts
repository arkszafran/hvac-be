import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

import { JobsOidcGuard } from './jobs-oidc.guard';

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(),
}));

describe('JobsOidcGuard', () => {
  let verifyIdToken: jest.Mock;
  let configService: {
    getOrThrow: jest.Mock;
  };
  let guard: JobsOidcGuard;

  beforeEach(() => {
    verifyIdToken = jest.fn();
    (OAuth2Client as unknown as jest.Mock).mockReturnValue({
      verifyIdToken,
    });
    configService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          QUEUE_JOBS_OIDC_AUDIENCE: 'https://worker.example.com/queues/jobs',
          QUEUE_JOBS_OIDC_SERVICE_ACCOUNT_EMAIL:
            'tasks@example.iam.gserviceaccount.com',
        };

        return values[key];
      }),
    };
    guard = new JobsOidcGuard(
      configService as unknown as ConstructorParameters<
        typeof JobsOidcGuard
      >[0],
    );
  });

  it('throws unauthorized when bearer token is missing', async () => {
    await expect(
      guard.canActivate(createContext(undefined)),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('throws unauthorized when token email does not match service account', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: 'other@example.iam.gserviceaccount.com' }),
    });

    await expect(
      guard.canActivate(createContext('Bearer token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows request when OIDC token is valid for expected service account', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: 'tasks@example.iam.gserviceaccount.com' }),
    });

    await expect(
      guard.canActivate(createContext('Bearer token')),
    ).resolves.toBe(true);

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'token',
      audience: 'https://worker.example.com/queues/jobs',
    });
  });
});

function createContext(authorization: string | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          authorization,
        },
      }),
    }),
  } as Parameters<JobsOidcGuard['canActivate']>[0];
}

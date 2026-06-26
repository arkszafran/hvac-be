import { ForbiddenException } from '@nestjs/common';

import { OriginGuard } from './origin.guard';
import { SKIP_ORIGIN_CHECK_KEY } from './origin.constants';

describe('OriginGuard', () => {
  let configService: {
    getOrThrow: jest.Mock;
  };
  let reflector: {
    getAllAndOverride: jest.Mock;
  };
  let guard: OriginGuard;

  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          ALLOWED_BROWSER_ORIGINS:
            'https://app.example.com,http://localhost:4200,https://api.example.com',
        };

        return values[key];
      }),
    };
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };
    guard = new OriginGuard(
      configService as unknown as ConstructorParameters<typeof OriginGuard>[0],
      reflector as unknown as ConstructorParameters<typeof OriginGuard>[1],
    );
  });

  it('allows non-mutating requests without origin', () => {
    expect(guard.canActivate(createContext('GET'))).toBe(true);
  });

  it('allows mutating requests from configured origin', () => {
    expect(
      guard.canActivate(createContext('POST', 'https://app.example.com')),
    ).toBe(true);
  });

  it('allows mutating requests from backend origin', () => {
    expect(
      guard.canActivate(createContext('POST', 'https://api.example.com')),
    ).toBe(true);
  });

  it('rejects mutating requests without origin', () => {
    expect(() => guard.canActivate(createContext('POST'))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects mutating requests from untrusted origin', () => {
    expect(() =>
      guard.canActivate(createContext('POST', 'https://evil.example.com')),
    ).toThrow(ForbiddenException);
  });

  it('allows requests when origin check is skipped', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === SKIP_ORIGIN_CHECK_KEY ? true : false,
    );

    expect(guard.canActivate(createContext('POST'))).toBe(true);
  });
});

function createContext(method: string, origin?: string) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        headers: {
          origin,
        },
      }),
    }),
  } as Parameters<OriginGuard['canActivate']>[0];
}

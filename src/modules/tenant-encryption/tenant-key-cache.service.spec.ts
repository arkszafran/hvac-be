import { ConfigService } from '@nestjs/config';

import { TenantKeyCacheService } from './tenant-key-cache.service';

describe('TenantKeyCacheService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads a key only once for concurrent requests', async () => {
    const cache = createCache(300, 10);
    let resolveLoader: ((value: Buffer) => void) | undefined;
    const loader = jest.fn(
      () =>
        new Promise<Buffer>((resolve) => {
          resolveLoader = resolve;
        }),
    );

    const firstPromise = cache.getOrLoad('tenant:1', loader);
    const secondPromise = cache.getOrLoad('tenant:1', loader);
    resolveLoader?.(Buffer.alloc(32, 8));
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    first.fill(0);
    expect(second).toEqual(Buffer.alloc(32, 8));
  });

  it('reloads a key after TTL expires', async () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const cache = createCache(5, 10);
    const loader = jest.fn().mockResolvedValue(Buffer.alloc(32, 2));

    await cache.getOrLoad('tenant:1', loader);
    jest.advanceTimersByTime(5_001);
    await cache.getOrLoad('tenant:1', loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('evicts the least recently used entry when full', async () => {
    const cache = createCache(300, 2);
    const loader = jest.fn().mockResolvedValue(Buffer.alloc(32, 1));

    await cache.getOrLoad('tenant:1', loader);
    await cache.getOrLoad('tenant:2', loader);
    await cache.getOrLoad('tenant:1', loader);
    await cache.getOrLoad('tenant:3', loader);
    await cache.getOrLoad('tenant:2', loader);

    expect(loader).toHaveBeenCalledTimes(4);
  });
});

function createCache(ttlSeconds: number, maxEntries: number) {
  const configService = {
    getOrThrow: jest.fn((key: string) =>
      key === 'PII_DEK_CACHE_TTL_SECONDS' ? ttlSeconds : maxEntries,
    ),
  };

  return new TenantKeyCacheService(configService as unknown as ConfigService);
}

import { initializePasswordPepper } from '../security/password/password';

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const passwordPepper = config.PASSWORD_PEPPER_BASE64;

  initializePasswordPepper(
    typeof passwordPepper === 'string' ? passwordPepper : undefined,
  );

  assertRequiredString(config, 'JWT_ACCESS_SECRET');
  assertRequiredString(config, 'FRONTEND_ORIGIN');
  assertRequiredString(config, 'COOKIE_SAME_SITE');
  assertRequiredString(config, 'COOKIE_SECURE');
  assertPositiveInteger(config, 'ACCESS_TOKEN_TTL_MINUTES');
  assertPositiveInteger(config, 'REFRESH_TOKEN_LENGTH');
  assertPositiveInteger(config, 'REFRESH_TOKEN_TTL_DAYS');
  assertPositiveInteger(config, 'SESSION_DURATION_HOURS');
  assertPositiveInteger(config, 'PIN_RETRIES_NUMBER');
  assertPositiveInteger(config, 'LOGIN_RETRIES_NUMBER');

  return config;
}

function assertRequiredString(
  config: Record<string, unknown>,
  key: string,
): void {
  const value = config[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} env is required.`);
  }
}

function assertPositiveInteger(
  config: Record<string, unknown>,
  key: string,
): void {
  const value = config[key];
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${key} env must be a positive integer.`);
  }
}

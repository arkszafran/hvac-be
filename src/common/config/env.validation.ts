import { initializePasswordPepper } from '../security/password/password';

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const passwordPepper = config.PASSWORD_PEPPER_BASE64;

  initializePasswordPepper(
    typeof passwordPepper === 'string' ? passwordPepper : undefined,
  );

  return config;
}

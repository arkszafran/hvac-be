export { AUTH_COOKIE_NAMES } from '../../common/security/auth/auth.constants';

export const AUTH_ERROR_CODES = {
  invalidCredentials: 'INVALID_CREDENTIALS',
  invalidPin: 'INVALID_PIN',
  refreshTokenMissing: 'REFRESH_TOKEN_MISSING',
  refreshTokenInvalid: 'REFRESH_TOKEN_INVALID',
  pinRequired: 'PIN_REQUIRED',
  loginRequired: 'LOGIN_REQUIRED',
  loginRetriesLimitReached: 'LOGIN_RETRIES_LIMIT_REACHED',
  invalidAccountUnlockCode: 'INVALID_ACCOUNT_UNLOCK_CODE',
  accountUnlockCodeExpired: 'ACCOUNT_UNLOCK_CODE_EXPIRED',
  accountUnlockCodeRetriesLimitReached:
    'ACCOUNT_UNLOCK_CODE_RETRIES_LIMIT_REACHED',
  invalidPasswordResetCode: 'INVALID_PASSWORD_RESET_CODE',
} as const;

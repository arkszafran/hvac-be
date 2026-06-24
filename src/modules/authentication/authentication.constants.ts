export const AUTH_COOKIE_NAMES = {
  accessToken: 'authToken',
  refreshToken: 'refreshToken',
  userId: 'userId',
} as const;

export const AUTH_ERROR_CODES = {
  invalidCredentials: 'INVALID_CREDENTIALS',
  invalidPin: 'INVALID_PIN',
  refreshTokenMissing: 'REFRESH_TOKEN_MISSING',
  refreshTokenInvalid: 'REFRESH_TOKEN_INVALID',
  pinRequired: 'PIN_REQUIRED',
  loginRequired: 'LOGIN_REQUIRED',
  loginRetriesLimitReached: 'LOGIN_RETRIES_LIMIT_REACHED',
  invalidAccountUnlockCode: 'INVALID_ACCOUNT_UNLOCK_CODE',
} as const;

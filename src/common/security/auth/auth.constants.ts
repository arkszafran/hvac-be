export const AUTH_COOKIE_NAMES = {
  accessToken: 'authToken',
  refreshToken: 'refreshToken',
  userId: 'userId',
} as const;

export const AUTH_GUARD_ERROR_CODES = {
  accessTokenMissing: 'ACCESS_TOKEN_MISSING',
  accessTokenInvalid: 'ACCESS_TOKEN_INVALID',
  userNotFound: 'USER_NOT_FOUND',
  accountBlocked: 'ACCOUNT_BLOCKED',
  accountSetupRequired: 'ACCOUNT_SETUP_REQUIRED',
  accessDenied: 'ACCESS_DENIED',
  tenantIdMissing: 'TENANT_ID_MISSING',
  tenantAccessDenied: 'TENANT_ACCESS_DENIED',
} as const;

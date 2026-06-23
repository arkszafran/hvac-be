export const AUTH_COOKIE_NAMES = {
  accessToken: 'authToken',
  refreshToken: 'refreshToken',
  userId: 'userId',
} as const;

export const AUTH_REDIRECT_REASONS = {
  pinRequired: 'PIN_REQUIRED',
  loginRequired: 'LOGIN_REQUIRED',
} as const;

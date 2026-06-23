import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Response } from 'express';

import {
  hashPassword,
  verifyPassword,
} from '../../common/security/password/password';
import { AUTH_COOKIE_NAMES } from './authentication.constants';
import type {
  AccessTokenPayload,
  AuthUserWithTenants,
  RequestWithCookies,
} from './authentication.types';

type CookieSameSite = 'lax' | 'strict' | 'none';

@Injectable()
export class AuthenticationTokenService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async createAccessToken(user: AuthUserWithTenants): Promise<string> {
    const payload: AccessTokenPayload = {
      userId: user.id,
      role: user.role,
      tenants: user.tenants.map((tenant) => ({
        id: tenant.tenantId,
        role: tenant.role,
      })),
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.getAccessTokenTtlSeconds(),
    });
  }

  createRefreshToken(): string {
    const refreshTokenLength = this.getNumberEnv('REFRESH_TOKEN_LENGTH');

    return randomBytes(Math.ceil((refreshTokenLength * 3) / 4))
      .toString('base64url')
      .slice(0, refreshTokenLength);
  }

  hashToken(token: string): Promise<string> {
    return hashPassword(token);
  }

  verifyToken(token: string, hash: string): Promise<boolean> {
    return verifyPassword(token, hash);
  }

  getRefreshTokenValidTo(now = new Date()): Date {
    const refreshTokenTtlDays = this.getNumberEnv('REFRESH_TOKEN_TTL_DAYS');
    const validTo = new Date(now);
    validTo.setDate(validTo.getDate() + refreshTokenTtlDays);

    return validTo;
  }

  getSessionUnlockedUntil(now = new Date()): Date {
    const sessionDurationHours = this.getNumberEnv('SESSION_DURATION_HOURS');
    const unlockedUntil = new Date(now);
    unlockedUntil.setHours(unlockedUntil.getHours() + sessionDurationHours);

    return unlockedUntil;
  }

  getPinRetriesNumber(): number {
    return this.getNumberEnv('PIN_RETRIES_NUMBER');
  }

  getLoginRetriesNumber(): number {
    return this.getNumberEnv('LOGIN_RETRIES_NUMBER');
  }

  getFrontendRedirect(path: string): string {
    const frontendOrigin =
      this.configService.getOrThrow<string>('FRONTEND_ORIGIN');

    return `${frontendOrigin.replace(/\/$/, '')}${path}`;
  }

  getCookie(request: RequestWithCookies, name: string): string | undefined {
    const cookies = request.cookies as
      | Record<string, string | undefined>
      | undefined;

    return cookies?.[name];
  }

  setAuthCookies(input: {
    response: Response;
    accessToken: string;
    refreshToken: string;
    userId: string;
  }): void {
    this.setAccessTokenCookie(input.response, input.accessToken);
    this.setRefreshTokenCookie(input.response, input.refreshToken);
    this.setUserIdCookie(input.response, input.userId);
  }

  setAccessTokenCookie(response: Response, accessToken: string): void {
    response.cookie(
      AUTH_COOKIE_NAMES.accessToken,
      accessToken,
      this.getCookieOptions({
        httpOnly: true,
        maxAge: this.getAccessTokenTtlSeconds() * 1000,
      }),
    );
  }

  setRefreshTokenCookie(response: Response, refreshToken: string): void {
    const refreshTokenTtlMilliseconds = this.getRefreshTokenTtlMilliseconds();

    response.cookie(
      AUTH_COOKIE_NAMES.refreshToken,
      refreshToken,
      this.getCookieOptions({
        httpOnly: true,
        maxAge: refreshTokenTtlMilliseconds,
      }),
    );
  }

  setUserIdCookie(response: Response, userId: string): void {
    const refreshTokenTtlMilliseconds = this.getRefreshTokenTtlMilliseconds();

    response.cookie(
      AUTH_COOKIE_NAMES.userId,
      userId,
      this.getCookieOptions({
        httpOnly: true,
        maxAge: refreshTokenTtlMilliseconds,
      }),
    );
  }

  clearAuthCookies(response: Response): void {
    const options = this.getCookieOptions({ httpOnly: true });

    response.clearCookie(AUTH_COOKIE_NAMES.accessToken, options);
    response.clearCookie(AUTH_COOKIE_NAMES.refreshToken, options);
    response.clearCookie(AUTH_COOKIE_NAMES.userId, options);
  }

  private getCookieOptions(input: {
    httpOnly: boolean;
    maxAge?: number;
  }): CookieOptions {
    return {
      httpOnly: input.httpOnly,
      secure: this.getCookieSecure(),
      sameSite: this.getCookieSameSite(),
      path: '/',
      maxAge: input.maxAge,
    };
  }

  private getCookieSameSite(): CookieSameSite {
    const configured = this.configService
      .getOrThrow<string>('COOKIE_SAME_SITE')
      .toLowerCase();

    if (
      configured === 'lax' ||
      configured === 'strict' ||
      configured === 'none'
    ) {
      return configured;
    }

    throw new Error('COOKIE_SAME_SITE env must be lax, strict, or none.');
  }

  private getCookieSecure(): boolean {
    const configured = this.configService.getOrThrow<string>('COOKIE_SECURE');

    if (configured === 'true') {
      return true;
    }

    if (configured === 'false') {
      return false;
    }

    throw new Error('COOKIE_SECURE env must be true or false.');
  }

  private getAccessTokenTtlSeconds(): number {
    return this.getNumberEnv('ACCESS_TOKEN_TTL_MINUTES') * 60;
  }

  private getRefreshTokenTtlMilliseconds(): number {
    return this.getNumberEnv('REFRESH_TOKEN_TTL_DAYS') * 24 * 60 * 60 * 1000;
  }

  private getNumberEnv(key: string): number {
    return Number(this.configService.getOrThrow<string | number>(key));
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { Request } from 'express';

@Injectable()
export class JobsOidcGuard implements CanActivate {
  private readonly client = new OAuth2Client();

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.getBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Queue job authorization is missing.');
    }

    const audience = this.configService.getOrThrow<string>(
      'QUEUE_JOBS_OIDC_AUDIENCE',
    );
    const serviceAccountEmail = this.configService.getOrThrow<string>(
      'QUEUE_JOBS_OIDC_SERVICE_ACCOUNT_EMAIL',
    );

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience,
      });
      const payload = ticket.getPayload();

      if (payload?.email !== serviceAccountEmail) {
        throw new UnauthorizedException('Queue job authorization is invalid.');
      }

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Queue job authorization is invalid.');
    }
  }

  private getBearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return undefined;
    }

    return token;
  }
}

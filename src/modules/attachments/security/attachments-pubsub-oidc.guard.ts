import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import { GoogleOidcTokenVerifierService } from '../../../common/pubsub/google-oidc-token-verifier.service';
import { apiError } from '../../../common/types/api-response.type';

@Injectable()
export class AttachmentsPubSubOidcGuard implements CanActivate {
  constructor(
    private readonly verifier: GoogleOidcTokenVerifierService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = getBearerToken(request);

    if (!token) {
      throw new UnauthorizedException(
        apiError({
          code: 'PUBSUB_AUTHORIZATION_MISSING',
          message: 'Pub/Sub authorization is missing.',
        }),
      );
    }

    await this.verifier.verify({
      token,
      audience: this.configService.getOrThrow<string>(
        'ATTACHMENTS_PUBSUB_OIDC_AUDIENCE',
      ),
      serviceAccountEmail: this.configService.getOrThrow<string>(
        'ATTACHMENTS_PUBSUB_OIDC_SERVICE_ACCOUNT_EMAIL',
      ),
    });

    return true;
  }
}

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.authorization;

  if (!authorization) {
    return undefined;
  }

  const [scheme, token, extra] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token || extra) {
    return undefined;
  }

  return token;
}

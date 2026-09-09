import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

import { apiError } from '../types/api-response.type';

export type VerifyGoogleOidcTokenInput = {
  readonly token: string;
  readonly audience: string;
  readonly serviceAccountEmail: string;
};

@Injectable()
export class GoogleOidcTokenVerifierService {
  private readonly client = new OAuth2Client();

  async verify(input: VerifyGoogleOidcTokenInput): Promise<void> {
    let email: string | undefined;
    let emailVerified = false;

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: input.token,
        audience: input.audience,
      });
      const payload = ticket.getPayload();

      email = payload?.email;
      emailVerified = payload?.email_verified === true;
    } catch {
      throwInvalidPubSubAuthorization();
    }

    if (email !== input.serviceAccountEmail || !emailVerified) {
      throwInvalidPubSubAuthorization();
    }
  }
}

function throwInvalidPubSubAuthorization(): never {
  throw new UnauthorizedException(
    apiError({
      code: 'PUBSUB_AUTHORIZATION_INVALID',
      message: 'Pub/Sub authorization is invalid.',
    }),
  );
}

import { Module } from '@nestjs/common';

import { GoogleOidcTokenVerifierService } from './google-oidc-token-verifier.service';
import { PubSubMessageDecoderService } from './pubsub-message-decoder.service';

@Module({
  providers: [GoogleOidcTokenVerifierService, PubSubMessageDecoderService],
  exports: [GoogleOidcTokenVerifierService, PubSubMessageDecoderService],
})
export class PubSubModule {}

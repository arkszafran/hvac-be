import { Module } from '@nestjs/common';
import { KeyManagementServiceClient } from '@google-cloud/kms';

import { AesGcmCipherService } from './aes-gcm-cipher.service';
import { GoogleKmsService, KMS_CLIENT } from './google-kms.service';

@Module({
  providers: [
    {
      provide: KMS_CLIENT,
      useFactory: (): KeyManagementServiceClient =>
        new KeyManagementServiceClient(),
    },
    GoogleKmsService,
    AesGcmCipherService,
  ],
  exports: [GoogleKmsService, AesGcmCipherService],
})
export class EncryptionModule {}

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

//import { fieldEncryptionMiddleware } from 'prisma-field-encryption';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    //this.addFieldEncryptionMiddleware();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // private addFieldEncryptionMiddleware() {
  //     const encryptionKey = process.env.PRISMA_ENCRYPTION_FIELD_KEY;

  //     if (!encryptionKey) {
  //         throw new Error(
  //             'PRISMA_ENCRYPTION_FIELD_KEY env is missing, use https://cloak.47ng.com/ to generate new.',
  //         );
  //     }

  //     this.$use(fieldEncryptionMiddleware({ encryptionKey }));
  // }
}

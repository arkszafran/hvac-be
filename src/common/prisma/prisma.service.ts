import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@generated/prisma/client';

//import { fieldEncryptionMiddleware } from 'prisma-field-encryption';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL env is missing.');
    }
    super({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
    // this.addFieldEncryptionMiddleware();
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

import { BaseSeed } from 'prisma/seed-base/seed-base.class';
import { ISeedResult } from 'prisma/seed-base/seed.interface';
import { initializePasswordPepper } from '../../../src/common/security/password/password';

export default class InitialSeed extends BaseSeed {
  async execute(): Promise<ISeedResult> {
    initializePasswordPepper();

    const prisma = this.prismaClient;
  }
}

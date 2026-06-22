import { BaseSeed } from 'prisma/seed-base/seed-base.class';
import { ISeedResult } from 'prisma/seed-base/seed.interface';
import {
  initializePasswordPepper,
  hashPassword,
} from '../../../src/common/security/password/password';
import { UserRole } from '@generated/prisma/enums';

export default class InitialSeed extends BaseSeed {
  async execute(): Promise<ISeedResult> {
    initializePasswordPepper();
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASS;
    if (!email || !password) {
      throw new Error('email or password doesnt exists');
    }

    await this.prismaClient.user.create({
      data: {
        email: email,
        name: 'Arek admin',
        password: await hashPassword(password),
        role: UserRole.ADMIN,
      },
    });
    return { success: true };
  }
}

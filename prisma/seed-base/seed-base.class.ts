import { PrismaClient } from '@generated/prisma/client';
import { ISeedResult } from './seed.interface';

export class BaseSeed {
  constructor(protected prismaClient: PrismaClient) {}

  async execute(): Promise<ISeedResult> {
    return { success: true };
  }
}

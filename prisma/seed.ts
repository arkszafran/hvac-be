import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@generated/prisma/client';

import { ISeed } from './seed-base/seed.interface';
import { BaseSeed } from './seed-base/seed-base.class';
import { ESeedStatus } from './seed-base/seed.enum';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL env is missing.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

type SeedModule = {
  default: new (prismaClient: PrismaClient) => BaseSeed;
};

async function main() {
  const completedSeedsIds = await getCompletedSeedsIds();
  const allSeeds = getSeedsList();

  for (const seedItem of allSeeds) {
    if (completedSeedsIds.includes(seedItem.id)) {
      console.log(`Seed ${seedItem.id} already executed.`);
      continue;
    }

    await prisma.seed.create({
      data: {
        id: seedItem.id,
        startedAt: new Date(),
        status: ESeedStatus.STARTED,
      },
    });

    try {
      const seedImport = require(seedItem.path) as SeedModule;
      const seed: BaseSeed = new seedImport.default(prisma);

      await seed.execute();

      await prisma.seed.update({
        where: { id: seedItem.id },
        data: { status: ESeedStatus.SUCCESS, finishedAt: new Date() },
      });

      console.error(`Seed ${seedItem.id} completed successfully.`);
    } catch (e) {
      await prisma.seed.update({
        where: { id: seedItem.id },
        data: { status: ESeedStatus.ERROR, error: e.message },
      });
      console.error(`Seed ${seedItem.id} fail, error:${e.message}`);

      throw e;
    }
  }
}

async function getCompletedSeedsIds(): Promise<string[]> {
  const seeds = await prisma.seed.findMany();
  const uncompletedSeed = seeds.find(
    (seed) => seed.status === ESeedStatus.ERROR,
  );

  if (uncompletedSeed) {
    throw new Error(
      `In DB exist uncompleted seed: ${uncompletedSeed.id} check details in seed db table.`,
    );
  }

  return seeds.map((seed) => seed.id);
}

function getSeedsList(): ISeed[] {
  const mainSeedsDir = path.join(__dirname, 'seeds');
  const seedsDirectories = fs.readdirSync(mainSeedsDir);

  const seeds = seedsDirectories.map((seedDirectory) => {
    const seedFileNames = [
      `${seedDirectory}.seed.ts`,
      `${seedDirectory}.ts`,
    ];
    const seedFileFullPath = seedFileNames
      .map((seedFileName) =>
        path.join(mainSeedsDir, seedDirectory, seedFileName),
      )
      .find((seedFilePath) => fs.existsSync(seedFilePath));

    if (!seedFileFullPath) {
      throw Error(
        `In directory ${seedDirectory} doesn't exist file ${seedFileNames.join(' or ')}`,
      );
    }

    return {
      id: seedDirectory,
      date: getSeedDate(seedDirectory),
      path: seedFileFullPath,
    } as ISeed;
  });

  return seeds.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getSeedDate(seedDirectory: string): Date {
  try {
    const monthIndex = 1;
    const dateString = seedDirectory.split('_seed')[0];
    const dateParts = dateString
      .split('-')
      .map((datePart, index) =>
        index == monthIndex ? parseInt(datePart) - 1 : parseInt(datePart),
      );

    return new Date(
      dateParts[0],
      dateParts[1],
      dateParts[2],
      dateParts[3],
      dateParts[4],
    );
  } catch {
    throw Error(
      `${seedDirectory} directory name or date format is invalid, please change to YYYY-mm-dd-hh-mm_seed-{custom-part}`,
    );
  }
}

main()
  .catch((e) => {
    console.log(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "refreshTokenHash" TEXT,
ADD COLUMN "refreshTokenValidTo" TIMESTAMP(3),
ADD COLUMN "sessionUnlockedUntil" TIMESTAMP(3);

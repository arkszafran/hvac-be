ALTER TABLE "User"
ADD COLUMN "passwordResetCodeHash" TEXT,
ADD COLUMN "passwordResetCodeValidTo" TIMESTAMP(3);

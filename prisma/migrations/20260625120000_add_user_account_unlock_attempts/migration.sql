ALTER TABLE "User"
ADD COLUMN "accountUnlockCodeValidTo" TIMESTAMP(3),
ADD COLUMN "accountUnlockIncorrectCounter" INTEGER NOT NULL DEFAULT 0;

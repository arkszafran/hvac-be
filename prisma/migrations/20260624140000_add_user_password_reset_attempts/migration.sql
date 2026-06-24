ALTER TABLE "User"
ADD COLUMN "passwordResetIncorrectCounter" INTEGER NOT NULL DEFAULT 0;

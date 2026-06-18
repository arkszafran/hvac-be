-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'blocked', 'new');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TENANT_USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserTenantRole" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'new',
    "incorrectLoginCounter" INTEGER NOT NULL DEFAULT 0,
    "incorrectPINCounter" INTEGER NOT NULL DEFAULT 0,
    "role" "UserRole" NOT NULL DEFAULT 'TENANT_USER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User_tenant" (
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "role" "UserTenantRole" NOT NULL DEFAULT 'USER',

    CONSTRAINT "User_tenant_pkey" PRIMARY KEY ("userId","tenantId")
);

-- CreateTable
CREATE TABLE "Seed" (
    "id" VARCHAR(255) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "status" VARCHAR(20),
    "error" TEXT,

    CONSTRAINT "Seed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Seed_id_key" ON "Seed"("id");

-- AddForeignKey
ALTER TABLE "User_tenant" ADD CONSTRAINT "User_tenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User_tenant" ADD CONSTRAINT "User_tenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `address` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `companyName` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `postalCode` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `devices` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `devices` table. All the data in the column will be lost.
  - You are about to drop the column `postalCode` on the `devices` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `serviceOrders` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `serviceOrders` table. All the data in the column will be lost.
  - You are about to drop the column `companyName` on the `serviceOrders` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `serviceOrders` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `serviceOrders` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `serviceOrders` table. All the data in the column will be lost.
  - You are about to drop the column `postalCode` on the `serviceOrders` table. All the data in the column will be lost.
  - Added the required column `piiCiphertext` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `piiKeyVersion` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `piiNonce` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerSnapshotCiphertext` to the `serviceOrders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerSnapshotKeyVersion` to the `serviceOrders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerSnapshotNonce` to the `serviceOrders` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "tenantEncryptionKeyStatusEnum" AS ENUM ('active', 'decrypt_only', 'retired');

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "companyName",
DROP COLUMN "email",
DROP COLUMN "fullName",
DROP COLUMN "phone",
DROP COLUMN "postalCode",
ADD COLUMN     "piiCiphertext" BYTEA NOT NULL,
ADD COLUMN     "piiFormatVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "piiKeyVersion" INTEGER NOT NULL,
ADD COLUMN     "piiNonce" BYTEA NOT NULL;

-- AlterTable
ALTER TABLE "devices" DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "postalCode",
ADD COLUMN     "installationAddressCiphertext" BYTEA,
ADD COLUMN     "installationAddressFormatVersion" INTEGER,
ADD COLUMN     "installationAddressKeyVersion" INTEGER,
ADD COLUMN     "installationAddressNonce" BYTEA;

-- AlterTable
ALTER TABLE "serviceOrders" DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "companyName",
DROP COLUMN "email",
DROP COLUMN "fullName",
DROP COLUMN "phone",
DROP COLUMN "postalCode",
ADD COLUMN     "customerSnapshotCiphertext" BYTEA NOT NULL,
ADD COLUMN     "customerSnapshotFormatVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "customerSnapshotKeyVersion" INTEGER NOT NULL,
ADD COLUMN     "customerSnapshotNonce" BYTEA NOT NULL;

-- CreateTable
CREATE TABLE "tenantEncryptionKeys" (
    "tenantId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "wrappedDek" BYTEA NOT NULL,
    "kekKeyName" TEXT NOT NULL,
    "kekKeyVersion" TEXT NOT NULL,
    "status" "tenantEncryptionKeyStatusEnum" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMPTZ(6),

    CONSTRAINT "tenantEncryptionKeys_pkey" PRIMARY KEY ("tenantId","version")
);

-- CreateIndex
CREATE INDEX "tenantEncryptionKeys_tenantId_status_idx" ON "tenantEncryptionKeys"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "tenantEncryptionKeys" ADD CONSTRAINT "tenantEncryptionKeys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_piiKeyVersion_fkey" FOREIGN KEY ("tenantId", "piiKeyVersion") REFERENCES "tenantEncryptionKeys"("tenantId", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_tenantId_installationAddressKeyVersion_fkey" FOREIGN KEY ("tenantId", "installationAddressKeyVersion") REFERENCES "tenantEncryptionKeys"("tenantId", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serviceOrders" ADD CONSTRAINT "serviceOrders_tenantId_customerSnapshotKeyVersion_fkey" FOREIGN KEY ("tenantId", "customerSnapshotKeyVersion") REFERENCES "tenantEncryptionKeys"("tenantId", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

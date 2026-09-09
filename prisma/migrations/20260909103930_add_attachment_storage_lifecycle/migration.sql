-- CreateEnum
CREATE TYPE "attachmentScanStatusEnum" AS ENUM ('pending_upload', 'scanning', 'clean', 'quarantined', 'scan_failed', 'upload_expired');

-- AlterTable
ALTER TABLE "photoAttachments" DROP COLUMN "url",
ADD COLUMN     "contentType" VARCHAR(255) NOT NULL,
ADD COLUMN     "failureCode" VARCHAR(64),
ADD COLUMN     "objectKey" VARCHAR(1024) NOT NULL,
ADD COLUMN     "scanCompletedAt" TIMESTAMPTZ(6),
ADD COLUMN     "scanStatus" "attachmentScanStatusEnum" NOT NULL DEFAULT 'pending_upload',
ADD COLUMN     "sizeBytes" INTEGER NOT NULL,
ADD COLUMN     "storageGeneration" VARCHAR(32),
ADD COLUMN     "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "uploadExpiresAt" TIMESTAMPTZ(6) NOT NULL,
ADD COLUMN     "uploadedAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "photoAttachments_objectKey_key" ON "photoAttachments"("objectKey");

-- CreateIndex
CREATE INDEX "photoAttachments_tenantId_scanStatus_idx" ON "photoAttachments"("tenantId", "scanStatus");

-- CreateIndex
CREATE INDEX "photoAttachments_scanStatus_createdAt_idx" ON "photoAttachments"("scanStatus", "createdAt");

-- AlterTable
ALTER TABLE "serviceOrderDevices" ALTER COLUMN "deviceType" DROP NOT NULL,
ALTER COLUMN "brand" DROP NOT NULL,
ALTER COLUMN "model" DROP NOT NULL;

-- AlterTable
ALTER TABLE "serviceOrders" ALTER COLUMN "customerSnapshotCiphertext" DROP NOT NULL,
ALTER COLUMN "customerSnapshotFormatVersion" DROP NOT NULL,
ALTER COLUMN "customerSnapshotFormatVersion" DROP DEFAULT,
ALTER COLUMN "customerSnapshotKeyVersion" DROP NOT NULL,
ALTER COLUMN "customerSnapshotNonce" DROP NOT NULL;

-- AlterTable
ALTER TABLE "customers" RENAME COLUMN "customerType" TO "type";

-- AlterTable
ALTER TABLE "devices" RENAME COLUMN "deviceType" TO "type";

-- AlterTable
ALTER TABLE "serviceOrders" RENAME COLUMN "serviceOrderType" TO "type";

-- AlterTable
ALTER TABLE "visits" RENAME COLUMN "visitType" TO "type";

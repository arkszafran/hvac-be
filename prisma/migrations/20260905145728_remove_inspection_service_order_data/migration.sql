/*
  Warnings:

  - You are about to drop the `inspectionServiceOrderData` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "inspectionServiceOrderData" DROP CONSTRAINT "inspectionServiceOrderData_serviceOrderId_fkey";

-- DropTable
DROP TABLE "inspectionServiceOrderData";

-- DropEnum
DROP TYPE "customerConfirmationStatusEnum";

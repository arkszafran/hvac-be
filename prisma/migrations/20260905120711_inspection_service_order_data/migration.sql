-- CreateEnum
CREATE TYPE "customerConfirmationStatusEnum" AS ENUM ('pending', 'confirmed', 'not_confirmed');

-- CreateTable
CREATE TABLE "inspectionServiceOrderData" (
    "serviceOrderId" UUID NOT NULL,
    "customerConfirmationStatus" "customerConfirmationStatusEnum" NOT NULL DEFAULT 'pending',
    "confirmationReminderSentAt" TIMESTAMPTZ(6),

    CONSTRAINT "inspectionServiceOrderData_pkey" PRIMARY KEY ("serviceOrderId")
);

-- AddForeignKey
ALTER TABLE "inspectionServiceOrderData" ADD CONSTRAINT "inspectionServiceOrderData_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "serviceOrders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

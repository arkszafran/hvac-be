-- CreateEnum
CREATE TYPE "customerTypeEnum" AS ENUM ('company', 'individual');

-- CreateEnum
CREATE TYPE "deviceTypeEnum" AS ENUM ('air-conditioning', 'heat-pump', 'ventilation');

-- CreateEnum
CREATE TYPE "serviceOrderTypeEnum" AS ENUM ('installation', 'repair', 'inspection');

-- CreateEnum
CREATE TYPE "serviceOrderSourceEnum" AS ENUM ('customer-panel', 'website-form', 'user', 'system');

-- CreateEnum
CREATE TYPE "serviceOrderStatusEnum" AS ENUM ('new', 'contact_required', 'scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "serviceOrderBuildingTypeEnum" AS ENUM ('apartment-block', 'house', 'office-building');

-- CreateEnum
CREATE TYPE "serviceOrderOutdoorUnitPlaceEnum" AS ENUM ('wall', 'balcony', 'roof');

-- CreateEnum
CREATE TYPE "serviceOrderMessageChannelEnum" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "messageConfirmationStatusEnum" AS ENUM ('confirmed', 'not_confirmed');

-- CreateEnum
CREATE TYPE "visitTypeEnum" AS ENUM ('installation', 'repair', 'inspection');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerType" "customerTypeEnum" NOT NULL,
    "companyName" TEXT,
    "fullName" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "deviceType" "deviceTypeEnum" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "powerKw" DECIMAL(8,3),
    "serialNumber" TEXT,
    "installationDate" DATE,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 0,
    "warrantyUntil" DATE,
    "note" TEXT,
    "refrigerant" TEXT,
    "refrigerantAmount" TEXT,
    "location" TEXT,
    "hasCustomInstallationAddress" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serviceOrders" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "customerId" UUID,
    "customerType" "customerTypeEnum" NOT NULL,
    "companyName" TEXT,
    "fullName" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "serviceOrderType" "serviceOrderTypeEnum" NOT NULL,
    "source" "serviceOrderSourceEnum" NOT NULL,
    "status" "serviceOrderStatusEnum" NOT NULL,
    "assigneeUserId" UUID,
    "orderDate" TIMESTAMPTZ(6) NOT NULL,
    "scheduledAt" TIMESTAMPTZ(6),
    "nextContactAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serviceOrders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installationServiceOrderData" (
    "serviceOrderId" UUID NOT NULL,
    "buildingType" "serviceOrderBuildingTypeEnum" NOT NULL,

    CONSTRAINT "installationServiceOrderData_pkey" PRIMARY KEY ("serviceOrderId")
);

-- CreateTable
CREATE TABLE "serviceOrderRooms" (
    "id" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "area" DECIMAL(8,2) NOT NULL,
    "height" DECIMAL(6,2) NOT NULL,
    "outdoorUnitPlace" "serviceOrderOutdoorUnitPlaceEnum" NOT NULL,
    "estimatedDistanceToOutdoorUnit" DECIMAL(8,2),
    "floor" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "serviceOrderRooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serviceOrderDevices" (
    "id" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "systemDeviceId" UUID,
    "deviceType" "deviceTypeEnum" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT,
    "refrigerant" TEXT,
    "refrigerantAmount" TEXT,
    "displayedError" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "serviceOrderDevices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serviceOrderNotes" (
    "id" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "serviceOrderNotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messagesServiceOrder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "confirmationStatus" "messageConfirmationStatusEnum",
    "channel" "serviceOrderMessageChannelEnum" NOT NULL,
    "confirmationTokenHash" TEXT NOT NULL,
    "confirmationTokenExpiresAt" TIMESTAMPTZ(6) NOT NULL,
    "respondedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messagesServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "serviceOrderId" UUID,
    "customerId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "visitType" "visitTypeEnum" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitDevices" (
    "visitId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "visitDevices_pkey" PRIMARY KEY ("visitId","deviceId")
);

-- CreateTable
CREATE TABLE "photoAttachments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "serviceOrderId" UUID,
    "serviceOrderRoomId" UUID,
    "serviceOrderDeviceId" UUID,
    "serviceOrderNoteId" UUID,
    "visitId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photoAttachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_tenantId_idx" ON "customers"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenantId_id_key" ON "customers"("tenantId", "id");

-- CreateIndex
CREATE INDEX "devices_tenantId_idx" ON "devices"("tenantId");

-- CreateIndex
CREATE INDEX "serviceOrders_tenantId_status_scheduledAt_idx" ON "serviceOrders"("tenantId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "serviceOrders_tenantId_status_nextContactAt_idx" ON "serviceOrders"("tenantId", "status", "nextContactAt");

-- CreateIndex
CREATE UNIQUE INDEX "serviceOrders_tenantId_id_key" ON "serviceOrders"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "messagesServiceOrder_confirmationTokenHash_key" ON "messagesServiceOrder"("confirmationTokenHash");

-- CreateIndex
CREATE INDEX "visits_tenantId_idx" ON "visits"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "visits_tenantId_id_key" ON "visits"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "customers"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serviceOrders" ADD CONSTRAINT "serviceOrders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serviceOrders" ADD CONSTRAINT "serviceOrders_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "customers"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serviceOrders" ADD CONSTRAINT "serviceOrders_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installationServiceOrderData" ADD CONSTRAINT "installationServiceOrderData_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "serviceOrders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serviceOrderRooms" ADD CONSTRAINT "serviceOrderRooms_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "serviceOrders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serviceOrderDevices" ADD CONSTRAINT "serviceOrderDevices_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "serviceOrders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serviceOrderDevices" ADD CONSTRAINT "serviceOrderDevices_systemDeviceId_fkey" FOREIGN KEY ("systemDeviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serviceOrderNotes" ADD CONSTRAINT "serviceOrderNotes_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "serviceOrders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serviceOrderNotes" ADD CONSTRAINT "serviceOrderNotes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messagesServiceOrder" ADD CONSTRAINT "messagesServiceOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messagesServiceOrder" ADD CONSTRAINT "messagesServiceOrder_tenantId_serviceOrderId_fkey" FOREIGN KEY ("tenantId", "serviceOrderId") REFERENCES "serviceOrders"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_tenantId_serviceOrderId_fkey" FOREIGN KEY ("tenantId", "serviceOrderId") REFERENCES "serviceOrders"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "customers"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitDevices" ADD CONSTRAINT "visitDevices_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitDevices" ADD CONSTRAINT "visitDevices_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photoAttachments" ADD CONSTRAINT "photoAttachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photoAttachments" ADD CONSTRAINT "photoAttachments_tenantId_serviceOrderId_fkey" FOREIGN KEY ("tenantId", "serviceOrderId") REFERENCES "serviceOrders"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photoAttachments" ADD CONSTRAINT "photoAttachments_serviceOrderRoomId_fkey" FOREIGN KEY ("serviceOrderRoomId") REFERENCES "serviceOrderRooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photoAttachments" ADD CONSTRAINT "photoAttachments_serviceOrderDeviceId_fkey" FOREIGN KEY ("serviceOrderDeviceId") REFERENCES "serviceOrderDevices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photoAttachments" ADD CONSTRAINT "photoAttachments_serviceOrderNoteId_fkey" FOREIGN KEY ("serviceOrderNoteId") REFERENCES "serviceOrderNotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photoAttachments" ADD CONSTRAINT "photoAttachments_tenantId_visitId_fkey" FOREIGN KEY ("tenantId", "visitId") REFERENCES "visits"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

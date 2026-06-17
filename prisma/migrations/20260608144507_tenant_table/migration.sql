-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "person_name" VARCHAR(255) NOT NULL,
    "street" VARCHAR(100) NOT NULL,
    "city" VARCHAR(50) NOT NULL,
    "zip" VARCHAR(6) NOT NULL,
    "tax" VARCHAR(10) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

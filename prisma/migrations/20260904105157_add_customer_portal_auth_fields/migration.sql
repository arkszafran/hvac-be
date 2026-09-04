-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "emailLookupHash" BYTEA NOT NULL,
ADD COLUMN     "emailLookupKeyVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "portalLastLoginAt" TIMESTAMPTZ(6),
ADD COLUMN     "portalLoginTokenExpiresAt" TIMESTAMPTZ(6),
ADD COLUMN     "portalLoginTokenHash" BYTEA;

-- CreateIndex
CREATE INDEX "customers_tenantId_portalLoginTokenHash_idx" ON "customers"("tenantId", "portalLoginTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenantId_emailLookupHash_key" ON "customers"("tenantId", "emailLookupHash");

-- HMAC-SHA-256 and SHA-256 values must contain exactly 32 bytes.
ALTER TABLE "customers"
ADD CONSTRAINT "customers_email_lookup_valid"
CHECK (
  octet_length("emailLookupHash") = 32
  AND "emailLookupKeyVersion" > 0
);

-- A one-time login token hash and its expiration must always be set or cleared together.
ALTER TABLE "customers"
ADD CONSTRAINT "customers_portal_login_token_valid"
CHECK (
  (
    "portalLoginTokenHash" IS NULL
    AND "portalLoginTokenExpiresAt" IS NULL
  )
  OR
  (
    "portalLoginTokenHash" IS NOT NULL
    AND octet_length("portalLoginTokenHash") = 32
    AND "portalLoginTokenExpiresAt" IS NOT NULL
  )
);

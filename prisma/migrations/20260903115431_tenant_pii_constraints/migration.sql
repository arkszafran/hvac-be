-- CreateIndex
CREATE INDEX "tenantEncryptionKeys_kekKeyVersion_idx" ON "tenantEncryptionKeys"("kekKeyVersion");

-- Only one DEK may be active for a tenant. Prisma does not support partial indexes.
CREATE UNIQUE INDEX "tenantEncryptionKeys_one_active_per_tenant"
ON "tenantEncryptionKeys"("tenantId")
WHERE "status" = 'active';

ALTER TABLE "tenantEncryptionKeys"
ADD CONSTRAINT "tenantEncryptionKeys_version_positive"
CHECK ("version" > 0);

ALTER TABLE "customers"
ADD CONSTRAINT "customers_pii_encryption_valid"
CHECK (
  octet_length("piiNonce") = 12
  AND octet_length("piiCiphertext") >= 16
  AND "piiKeyVersion" > 0
  AND "piiFormatVersion" > 0
);

ALTER TABLE "serviceOrders"
ADD CONSTRAINT "serviceOrders_customer_snapshot_encryption_valid"
CHECK (
  octet_length("customerSnapshotNonce") = 12
  AND octet_length("customerSnapshotCiphertext") >= 16
  AND "customerSnapshotKeyVersion" > 0
  AND "customerSnapshotFormatVersion" > 0
);

ALTER TABLE "devices"
ADD CONSTRAINT "devices_custom_installation_address_encryption_valid"
CHECK (
  (
    "hasCustomInstallationAddress" = FALSE
    AND "installationAddressCiphertext" IS NULL
    AND "installationAddressNonce" IS NULL
    AND "installationAddressKeyVersion" IS NULL
    AND "installationAddressFormatVersion" IS NULL
  )
  OR
  (
    "hasCustomInstallationAddress" = TRUE
    AND "installationAddressCiphertext" IS NOT NULL
    AND octet_length("installationAddressCiphertext") >= 16
    AND "installationAddressNonce" IS NOT NULL
    AND octet_length("installationAddressNonce") = 12
    AND "installationAddressKeyVersion" > 0
    AND "installationAddressFormatVersion" > 0
  )
);

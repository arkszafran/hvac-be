import { initializePasswordPepper } from '../security/password/password';

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const passwordPepper = config.PASSWORD_PEPPER_BASE64;

  initializePasswordPepper(
    typeof passwordPepper === 'string' ? passwordPepper : undefined,
  );

  assertRequiredString(config, 'JWT_ACCESS_SECRET');
  assertRequiredUrl(config, 'FRONTEND_TENANT_ORIGIN');
  assertRequiredUrl(config, 'BE_BASE_URL');
  assertRequiredUrlList(config, 'ALLOWED_BROWSER_ORIGINS');
  assertRequiredString(config, 'COOKIE_SAME_SITE');
  assertRequiredString(config, 'COOKIE_SECURE');
  assertPositiveInteger(config, 'ACCESS_TOKEN_TTL_MINUTES');
  assertPositiveInteger(config, 'REFRESH_TOKEN_LENGTH');
  assertPositiveInteger(config, 'REFRESH_TOKEN_TTL_DAYS');
  assertPositiveInteger(config, 'SESSION_DURATION_HOURS');
  assertPositiveInteger(config, 'PIN_RETRIES_NUMBER');
  assertPositiveInteger(config, 'LOGIN_RETRIES_NUMBER');
  assertPositiveInteger(config, 'ACCOUNT_UNLOCK_CODE_TTL_MINUTES');
  assertPositiveInteger(config, 'ACCOUNT_UNLOCK_CODE_RETRIES_NUMBER');
  assertPositiveInteger(config, 'PASSWORD_RESET_CODE_TTL_MINUTES');
  assertPositiveInteger(config, 'PASSWORD_RESET_CODE_RETRIES_NUMBER');
  assertPositiveInteger(config, 'PASSWORD_RESET_REQUEST_COOLDOWN_MINUTES');
  assertRequiredString(config, 'GCP_PROJECT_ID');
  assertRequiredString(config, 'GCP_LOCATION');
  assertKmsKeyName(config, 'GCP_KMS_KEY_NAME');
  assertPositiveInteger(config, 'PII_DEK_CACHE_TTL_SECONDS');
  assertPositiveInteger(config, 'PII_DEK_CACHE_MAX_ENTRIES');
  assertPositiveInteger(config, 'CUSTOMERS_CLIENT_FILTERING_LIMIT');
  assertPositiveInteger(config, 'CUSTOMERS_PAGE_SIZE');
  assertPositiveInteger(config, 'DEVICES_CLIENT_FILTERING_LIMIT');
  assertPositiveInteger(config, 'DEVICES_PAGE_SIZE');
  assertBase64Bytes(config, 'CUSTOMER_EMAIL_LOOKUP_HMAC_SECRET_BASE64', 32);
  assertPositiveInteger(config, 'CUSTOMER_EMAIL_LOOKUP_HMAC_KEY_VERSION');
  assertRequiredUrl(config, 'PUBLIC_WORKER_BASE_URL');
  assertRequiredString(config, 'QUEUE_JOBS_OIDC_SERVICE_ACCOUNT_EMAIL');
  assertRequiredUrl(config, 'QUEUE_JOBS_OIDC_AUDIENCE');
  assertRequiredString(config, 'ATTACHMENTS_GCP_PROJECT_ID');
  assertRequiredString(config, 'ATTACHMENTS_GCP_LOCATION');
  assertRequiredString(config, 'ATTACHMENTS_UNSCANNED_BUCKET');
  assertRequiredString(config, 'ATTACHMENTS_CLEAN_BUCKET');
  assertRequiredString(config, 'ATTACHMENTS_QUARANTINED_BUCKET');
  assertRequiredString(config, 'ATTACHMENTS_PUBSUB_TOPIC');
  assertPubSubSubscriptionName(config, 'ATTACHMENTS_PUBSUB_SUBSCRIPTION');
  assertRequiredString(config, 'ATTACHMENTS_PUBSUB_OIDC_SERVICE_ACCOUNT_EMAIL');
  assertRequiredUrl(config, 'ATTACHMENTS_PUBSUB_OIDC_AUDIENCE');
  assertPositiveInteger(config, 'ATTACHMENTS_UPLOAD_EXPIRES_SECONDS');
  assertPositiveInteger(config, 'ATTACHMENTS_DOWNLOAD_EXPIRES_SECONDS');
  assertPositiveInteger(config, 'ATTACHMENTS_MAX_FILE_SIZE_BYTES');
  assertPositiveInteger(config, 'ATTACHMENTS_MAX_FILES_PER_REQUEST');
  assertPositiveInteger(config, 'THROTTLE_TTL_MS');
  assertPositiveInteger(config, 'THROTTLE_LIMIT');
  assertOptionalBoolean(config, 'SWAGGER_ON');
  assertSmtpUrl(config, 'SMTP_URL');
  assertRequiredString(config, 'SMTP_USER');
  assertRequiredString(config, 'SMTP_PASSWORD');
  assertRequiredString(config, 'SMTP_FROM_ADDRESS');
  assertRequiredString(config, 'SMTP_FROM_NAME');
  assertOptionalBoolean(config, 'SMTP_REQUIRE_TLS');
  assertOptionalBoolean(config, 'SMTP_REJECT_UNAUTHORIZED');
  assertOptionalPositiveInteger(config, 'SMTP_MAX_CONNECTIONS');
  assertOptionalPositiveInteger(config, 'SMTP_MAX_MESSAGES');
  assertOptionalPositiveInteger(config, 'SMTP_CONNECTION_TIMEOUT_MS');
  assertOptionalPositiveInteger(config, 'SMTP_GREETING_TIMEOUT_MS');
  assertOptionalPositiveInteger(config, 'SMTP_SOCKET_TIMEOUT_MS');

  return config;
}

function assertPubSubSubscriptionName(
  config: Record<string, unknown>,
  key: string,
): void {
  const value = config[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} env is required.`);
  }

  if (!/^projects\/[^/]+\/subscriptions\/[^/]+$/.test(value.trim())) {
    throw new Error(
      `${key} env must be a full Pub/Sub subscription resource name.`,
    );
  }
}

function assertBase64Bytes(
  config: Record<string, unknown>,
  key: string,
  expectedBytes: number,
): void {
  const value = config[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} env is required.`);
  }

  const normalizedValue = value.trim();

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedValue)) {
    throw new Error(`${key} env must be valid base64.`);
  }

  const decoded = Buffer.from(normalizedValue, 'base64');
  const canonicalValue = decoded.toString('base64');

  if (canonicalValue !== normalizedValue || decoded.length !== expectedBytes) {
    throw new Error(
      `${key} env must contain exactly ${expectedBytes} bytes encoded as base64.`,
    );
  }
}

function assertKmsKeyName(config: Record<string, unknown>, key: string): void {
  const value = config[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} env is required.`);
  }

  const cryptoKeyNamePattern =
    /^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+$/;

  if (!cryptoKeyNamePattern.test(value.trim())) {
    throw new Error(
      `${key} env must be a full Google Cloud KMS CryptoKey resource name without a key version.`,
    );
  }
}

function assertSmtpUrl(config: Record<string, unknown>, key: string): void {
  const value = config[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} env is required.`);
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} env must be a valid SMTP URL.`);
  }

  if (!['smtp:', 'smtps:'].includes(url.protocol)) {
    throw new Error(`${key} env protocol must be smtp or smtps.`);
  }

  if (url.port && !Number.isInteger(Number(url.port))) {
    throw new Error(`${key} env port must be an integer.`);
  }
}

function assertRequiredUrl(config: Record<string, unknown>, key: string): void {
  const value = config[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} env is required.`);
  }

  try {
    new URL(value);
  } catch {
    throw new Error(`${key} env must be a valid URL.`);
  }
}

function assertRequiredUrlList(
  config: Record<string, unknown>,
  key: string,
): void {
  const value = config[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} env is required.`);
  }

  const urls = value
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  if (!urls.length) {
    throw new Error(`${key} env must contain at least one URL.`);
  }

  for (const url of urls) {
    try {
      new URL(url);
    } catch {
      throw new Error(`${key} env must contain only valid URLs.`);
    }
  }
}

function assertRequiredString(
  config: Record<string, unknown>,
  key: string,
): void {
  const value = config[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} env is required.`);
  }
}

function assertPositiveInteger(
  config: Record<string, unknown>,
  key: string,
): void {
  const value = config[key];
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${key} env must be a positive integer.`);
  }
}

function assertOptionalPositiveInteger(
  config: Record<string, unknown>,
  key: string,
): void {
  if (config[key] === undefined) {
    return;
  }

  assertPositiveInteger(config, key);
}

function assertOptionalBoolean(
  config: Record<string, unknown>,
  key: string,
): void {
  const value = config[key];

  if (value === undefined) {
    return;
  }

  if (typeof value !== 'string') {
    throw new Error(`${key} env must be a boolean value.`);
  }

  const normalizedValue = value.trim().toLowerCase();

  if (
    !['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(
      normalizedValue,
    )
  ) {
    throw new Error(`${key} env must be a boolean value.`);
  }
}

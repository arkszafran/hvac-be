import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

const PASSWORD_PEPPER_ENV = 'PASSWORD_PEPPER_BASE64';
const PASSWORD_PEPPER_MIN_BYTES = 32;
const TEMPORARY_PASSWORD_DEFAULT_LENGTH = 20;

const ARGON2_PASSWORD_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 2,
  parallelism: 1,
} as const;

let passwordPepper: Buffer | undefined;

export function generateTemporaryPassword(
  length = TEMPORARY_PASSWORD_DEFAULT_LENGTH,
): string {
  if (!Number.isInteger(length) || length < 12) {
    throw new Error('Temporary password length must be an integer >= 12.');
  }

  const bytesLength = Math.ceil((length * 3) / 4);

  return randomBytes(bytesLength).toString('base64url').slice(0, length);
}

export function initializePasswordPepper(
  value = process.env[PASSWORD_PEPPER_ENV],
): Buffer {
  passwordPepper = validatePasswordPepperBase64(value);

  return passwordPepper;
}

export async function hashPassword(password: string): Promise<string> {
  assertPassword(password);

  return argon2.hash(password, {
    ...ARGON2_PASSWORD_OPTIONS,
    secret: getPasswordPepper(),
  });
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  assertPassword(password);

  if (!hash) {
    return false;
  }

  return argon2.verify(hash, password, {
    secret: getPasswordPepper(),
  });
}

export function getPasswordPepper(): Buffer {
  if (!passwordPepper) {
    throw new Error(
      'Password pepper is not initialized. Call initializePasswordPepper() at application startup.',
    );
  }

  return passwordPepper;
}

export function validatePasswordPepperBase64(
  value = process.env[PASSWORD_PEPPER_ENV],
): Buffer {
  if (!value?.trim()) {
    throw new Error(`${PASSWORD_PEPPER_ENV} env is required.`);
  }

  const normalizedValue = value.trim();

  if (
    normalizedValue.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedValue)
  ) {
    throw new Error(
      `${PASSWORD_PEPPER_ENV} must be a valid standard base64 value.`,
    );
  }

  const pepper = Buffer.from(normalizedValue, 'base64');

  if (pepper.toString('base64') !== normalizedValue) {
    throw new Error(
      `${PASSWORD_PEPPER_ENV} must be a valid standard base64 value.`,
    );
  }

  if (pepper.length < PASSWORD_PEPPER_MIN_BYTES) {
    throw new Error(
      `${PASSWORD_PEPPER_ENV} must decode to at least ${PASSWORD_PEPPER_MIN_BYTES} bytes.`,
    );
  }

  return pepper;
}

function assertPassword(password: string): void {
  if (!password) {
    throw new Error('Password is required.');
  }
}

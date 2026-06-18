import {
  generateTemporaryPassword,
  hashPassword,
  initializePasswordPepper,
  validatePasswordPepperBase64,
  verifyPassword,
} from './password';

describe('password helpers', () => {
  const originalPepper = process.env.PASSWORD_PEPPER_BASE64;
  const pepper = Buffer.alloc(32, 1).toString('base64');
  const differentPepper = Buffer.alloc(32, 2).toString('base64');

  beforeEach(() => {
    process.env.PASSWORD_PEPPER_BASE64 = pepper;
    initializePasswordPepper();
  });

  afterAll(() => {
    if (originalPepper === undefined) {
      delete process.env.PASSWORD_PEPPER_BASE64;
      return;
    }

    process.env.PASSWORD_PEPPER_BASE64 = originalPepper;
  });

  it('validates PASSWORD_PEPPER_BASE64', () => {
    expect(validatePasswordPepperBase64()).toHaveLength(32);
    expect(() => validatePasswordPepperBase64('not-base64')).toThrow(
      'PASSWORD_PEPPER_BASE64 must be a valid standard base64 value.',
    );
    expect(() =>
      validatePasswordPepperBase64(Buffer.alloc(16).toString('base64')),
    ).toThrow('PASSWORD_PEPPER_BASE64 must decode to at least 32 bytes.');
  });

  it('generates a temporary password', () => {
    const password = generateTemporaryPassword();

    expect(password).toHaveLength(20);
    expect(password).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashes and verifies a password with pepper', async () => {
    const hash = await hashPassword('temporary-password');

    await expect(verifyPassword('temporary-password', hash)).resolves.toBe(
      true,
    );
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);

    process.env.PASSWORD_PEPPER_BASE64 = differentPepper;

    await expect(verifyPassword('temporary-password', hash)).resolves.toBe(
      true,
    );

    initializePasswordPepper();

    await expect(verifyPassword('temporary-password', hash)).resolves.toBe(
      false,
    );
  });
});

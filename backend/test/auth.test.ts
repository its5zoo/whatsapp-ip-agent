import test from 'node:test';
import assert from 'node:assert';
import { authService } from '../src/services/authService';
import { env } from '../src/config/env';
import bcrypt from 'bcryptjs';

test.describe('Auth Service', () => {
  test('1. Valid login returns true', async () => {
    // We assume the test environment sets ADMIN_PASSWORD_HASH correctly to match some password
    // Wait, the tests need to control the environment. We should mock or set up env for the test.
    const originalUsername = env.ADMIN_USERNAME;
    const originalHash = env.ADMIN_PASSWORD_HASH;

    env.ADMIN_USERNAME = 'admin_test';
    // Hash for 'password123'
    env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('password123', 10);

    const result = await authService.validateLogin('admin_test', 'password123');
    assert.strictEqual(result, true);

    env.ADMIN_USERNAME = originalUsername;
    env.ADMIN_PASSWORD_HASH = originalHash;
  });

  test('2. Invalid password returns false', async () => {
    const originalUsername = env.ADMIN_USERNAME;
    const originalHash = env.ADMIN_PASSWORD_HASH;

    env.ADMIN_USERNAME = 'admin_test';
    env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('password123', 10);

    const result = await authService.validateLogin('admin_test', 'wrongpassword');
    assert.strictEqual(result, false);

    env.ADMIN_USERNAME = originalUsername;
    env.ADMIN_PASSWORD_HASH = originalHash;
  });

  test('3. Invalid username returns false', async () => {
    const originalUsername = env.ADMIN_USERNAME;
    const originalHash = env.ADMIN_PASSWORD_HASH;

    env.ADMIN_USERNAME = 'admin_test';
    env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('password123', 10);

    const result = await authService.validateLogin('wronguser', 'password123');
    assert.strictEqual(result, false);

    env.ADMIN_USERNAME = originalUsername;
    env.ADMIN_PASSWORD_HASH = originalHash;
  });

  test('4. Token generation and verification works', () => {
    const token = authService.generateToken();
    assert.ok(token);

    const payload = authService.verifyToken(token);
    assert.strictEqual(payload.sub, 'admin');
  });

  test('5. JWT with wrong secret is rejected', () => {
    const originalSecret = env.JWT_SECRET;

    env.JWT_SECRET = 'secret1';
    const token = authService.generateToken();

    env.JWT_SECRET = 'secret2';
    assert.throws(() => {
      authService.verifyToken(token);
    });

    env.JWT_SECRET = originalSecret;
  });
});

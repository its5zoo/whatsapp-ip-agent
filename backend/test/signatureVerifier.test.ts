import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { verifySignature } from '../src/whatsapp/signatureVerifier';
import crypto from 'node:crypto';

describe('verifySignature', () => {
  const secret = 'test-secret';
  const body = Buffer.from('{"test":"data"}');
  const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const validSignature = `sha256=${hash}`;

  test('should return true for a valid signature', () => {
    assert.strictEqual(verifySignature(body, validSignature, secret), true);
  });

  test('should return false for a wrong secret', () => {
    assert.strictEqual(verifySignature(body, validSignature, 'wrong-secret'), false);
  });

  test('should return false for a tampered body', () => {
    const tamperedBody = Buffer.from('{"test":"tampered"}');
    assert.strictEqual(verifySignature(tamperedBody, validSignature, secret), false);
  });

  test('should return false for missing signature header', () => {
    assert.strictEqual(verifySignature(body, undefined, secret), false);
  });

  test('should return false for malformed signature (no prefix)', () => {
    assert.strictEqual(verifySignature(body, hash, secret), false);
  });

  test('should return false for truncated hex', () => {
    assert.strictEqual(verifySignature(body, `sha256=${hash.substring(0, 10)}`, secret), false);
  });

  test('should return true for empty body with valid signature', () => {
    const emptyBody = Buffer.from('');
    const emptyHash = crypto.createHmac('sha256', secret).update(emptyBody).digest('hex');
    assert.strictEqual(verifySignature(emptyBody, `sha256=${emptyHash}`, secret), true);
  });
});

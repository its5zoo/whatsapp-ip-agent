import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import * as assert from 'node:assert';
import { WhatsappClient } from '../src/services/whatsappClient';
import { env } from '../src/config/env';

describe('WhatsappClient', () => {
  let client: WhatsappClient;
  let originalEnv: typeof env;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    client = new WhatsappClient();
    originalEnv = { ...env };
    originalConsoleError = console.error;

    env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
    env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    env.WHATSAPP_VERIFY_TOKEN = 'test-verify';
    env.META_APP_SECRET = 'test-secret';
    env.WHATSAPP_GRAPH_API_VERSION = 'v22.0';

    mock.method(global, 'fetch', async () => ({
      ok: true,
      status: 200,
    }));

    mock.method(console, 'error', () => {});
  });

  afterEach(() => {
    Object.assign(env, originalEnv);
    console.error = originalConsoleError;
    mock.restoreAll();
  });

  test('should send a text message with correct url, headers, and body', async () => {
    const result = await client.sendTextMessage('123456', 'hello world');
    assert.deepStrictEqual(result, { outcome: 'accepted' });

    const fetchCalls = (global.fetch as any).mock.calls;
    assert.strictEqual(fetchCalls.length, 1);
    const [url, options] = fetchCalls[0].arguments;

    assert.strictEqual(url, 'https://graph.facebook.com/v22.0/test-phone-id/messages');
    assert.strictEqual(options.method, 'POST');
    assert.deepStrictEqual(options.headers, {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json'
    });
    assert.deepStrictEqual(JSON.parse(options.body), {
      messaging_product: 'whatsapp',
      to: '123456',
      type: 'text',
      text: { body: 'hello world' }
    });
    assert.ok(options.signal instanceof AbortSignal);
  });

  test('should not throw on network timeout', async () => {
    mock.method(global, 'fetch', async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    });

    const result = await client.sendTextMessage('123456', 'hello');
    assert.strictEqual(result.outcome, 'unknown');
    const calls = (console.error as any).mock.calls;
    assert.ok(calls.some((c: any) => c.arguments[0] === 'WhatsappClient: Request to Meta Graph API timed out'));
  });

  test('should not throw on HTTP 400', async () => {
    mock.method(global, 'fetch', async () => ({
      ok: false,
      status: 400,
    }));

    const result = await client.sendTextMessage('123456', 'hello');
    assert.deepStrictEqual(result, {
      outcome: 'failed',
      retryable: false,
      error: 'Meta API returned 400'
    });
    const calls = (console.error as any).mock.calls;
    assert.ok(calls.some((c: any) => c.arguments[0] === 'WhatsappClient: Meta Graph API error, status: 400'));
    // Ensure token is not logged
    assert.strictEqual(calls.some((c: any) => String(c.arguments[0]).includes('test-token')), false);
  });

  test('should retry HTTP 429 responses', async () => {
    mock.method(global, 'fetch', async () => ({
      ok: false,
      status: 429,
    }));

    const result = await client.sendTextMessage('123456', 'hello');
    assert.deepStrictEqual(result, {
      outcome: 'failed',
      retryable: true,
      error: 'Meta API returned 429'
    });
  });

  test('should not throw on HTTP 500', async () => {
    mock.method(global, 'fetch', async () => ({
      ok: false,
      status: 500,
    }));

    const result = await client.sendTextMessage('123456', 'hello');
    assert.deepStrictEqual(result, {
      outcome: 'failed',
      retryable: true,
      error: 'Meta API returned 500'
    });
    const calls = (console.error as any).mock.calls;
    assert.ok(calls.some((c: any) => c.arguments[0] === 'WhatsappClient: Meta Graph API error, status: 500'));
  });

  test('should not log access token on generic error', async () => {
    mock.method(global, 'fetch', async () => {
      throw new Error('Generic connection error');
    });

    const result = await client.sendTextMessage('123456', 'hello');
    assert.strictEqual(result.outcome, 'unknown');
    const calls = (console.error as any).mock.calls;
    assert.strictEqual(calls.some((c: any) => String(c.arguments[0]).includes('test-token')), false);
  });
});

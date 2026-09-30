import { test, describe, before, beforeEach, afterEach, after, mock } from 'node:test';
import * as assert from 'node:assert';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { env } from '../src/config/env';
import { conversationService } from '../src/services/conversationService';
import prisma from '../src/db/prisma';
import { EvolutionWhatsAppProvider, normalizeEvolutionRecipient } from '../src/whatsapp/providers/evolution';

describe('Evolution webhook', () => {
  let app: FastifyInstance;
  let originalEnv: typeof env;
  let originalConsoleError: typeof console.error;

  before(async () => {
    originalEnv = { ...env };
    originalConsoleError = console.error;
    env.WHATSAPP_PROVIDER = 'meta';
    env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
    env.WHATSAPP_ACCESS_TOKEN = 'test-meta-token';
    env.WHATSAPP_VERIFY_TOKEN = 'test-verify';
    env.META_APP_SECRET = 'test-meta-secret';
    env.WHATSAPP_GRAPH_API_VERSION = 'v22.0';
    env.EVOLUTION_API_URL = 'https://evolution.example.com';
    env.EVOLUTION_API_KEY = 'test-api-key';
    env.EVOLUTION_INSTANCE = 'test-instance';
    env.EVOLUTION_WEBHOOK_SECRET = 'test-webhook-secret';

    app = buildApp();
    await app.ready();
  });

  beforeEach(async () => {
    await prisma.processedWhatsappMessage.deleteMany({});
    mock.method(conversationService, 'handleMessage', async () => 'mock response');
    mock.method((await import('../src/services/whatsappClient')).whatsappClient, 'sendTextMessage', async () => {});
    mock.method(app.log, 'error', () => {});
    mock.method(app.log, 'warn', () => {});
    mock.method(console, 'error', () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(async () => {
    Object.assign(env, originalEnv);
    console.error = originalConsoleError;
    await app.close();
  });

  function payload(overrides: Record<string, unknown> = {}) {
    return {
      event: 'messages.upsert',
      data: {
        key: {
          remoteJid: '15551112222@s.whatsapp.net',
          id: 'evolution-message-1',
          fromMe: false
        },
        messageType: 'conversation',
        message: { conversation: 'hello from Evolution' },
        ...overrides
      }
    };
  }

  function post(body: unknown, secret = 'test-webhook-secret') {
    return app.inject({
      method: 'POST',
      url: '/webhook/evolution',
      headers: {
        'content-type': 'application/json',
        'x-evolution-webhook-secret': secret
      },
      payload: JSON.stringify(body)
    });
  }

  test('rejects missing or invalid webhook authentication', async () => {
    const missing = await app.inject({
      method: 'POST',
      url: '/webhook/evolution',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(payload())
    });
    assert.strictEqual(missing.statusCode, 401);

    const invalid = await post(payload(), 'wrong-secret');
    assert.strictEqual(invalid.statusCode, 401);
  });

  test('processes valid text and dispatches the exact WhatsApp contract', async () => {
    const response = await post(payload());
    assert.strictEqual(response.statusCode, 200);

    await new Promise(resolve => setTimeout(resolve, 50));
    const dedup = await prisma.processedWhatsappMessage.findUnique({
      where: { messageId: 'evolution-message-1' }
    });
    assert.ok(dedup);
    assert.strictEqual(dedup?.waId, '15551112222@s.whatsapp.net');

    const calls = (conversationService.handleMessage as any).mock.calls;
    assert.deepStrictEqual(calls[0].arguments, [
      'whatsapp',
      '15551112222@s.whatsapp.net',
      'hello from Evolution'
    ]);
  });

  test('uses Meta outbound provider for Evolution inbound while Meta is active', async () => {
    const { whatsappClient } = await import('../src/services/whatsappClient');

    const response = await post(payload({
      key: {
        remoteJid: '15551112222@s.whatsapp.net',
        id: 'evolution-meta-outbound-1',
        fromMe: false
      }
    }));
    assert.strictEqual(response.statusCode, 200);
    await new Promise(resolve => setTimeout(resolve, 50));

    const calls = (whatsappClient.sendTextMessage as any).mock.calls;
    assert.deepStrictEqual(calls[0].arguments, [
      '15551112222@s.whatsapp.net',
      'mock response'
    ]);
  });

  test('ignores fromMe events and missing message IDs', async () => {
    const fromMe = await post(payload({
      key: {
        remoteJid: '15551112222@s.whatsapp.net',
        id: 'from-me-1',
        fromMe: true
      }
    }));
    assert.strictEqual(fromMe.statusCode, 200);

    const missingId = await post(payload({
      key: {
        remoteJid: '15551112222@s.whatsapp.net',
        id: '',
        fromMe: false
      }
    }));
    assert.strictEqual(missingId.statusCode, 200);

    await new Promise(resolve => setTimeout(resolve, 50));
    assert.strictEqual((conversationService.handleMessage as any).mock.calls.length, 0);
    assert.strictEqual(await prisma.processedWhatsappMessage.count(), 0);
  });

  test('deduplicates duplicate message IDs', async () => {
    await prisma.processedWhatsappMessage.create({
      data: {
        messageId: 'evolution-duplicate-1',
        waId: '15551112222@s.whatsapp.net'
      }
    });

    const response = await post(payload({
      key: {
        remoteJid: '15551112222@s.whatsapp.net',
        id: 'evolution-duplicate-1',
        fromMe: false
      }
    }));
    assert.strictEqual(response.statusCode, 200);

    await new Promise(resolve => setTimeout(resolve, 50));
    assert.strictEqual((conversationService.handleMessage as any).mock.calls.length, 0);
  });

  test('processes unsupported media through existing unsupported handling', async () => {
    const response = await post(payload({
      key: {
        remoteJid: '15551112222@s.whatsapp.net',
        id: 'evolution-image-1',
        fromMe: false
      },
      messageType: 'imageMessage',
      message: { imageMessage: {} }
    }));
    assert.strictEqual(response.statusCode, 200);

    await new Promise(resolve => setTimeout(resolve, 50));
    const dedup = await prisma.processedWhatsappMessage.findUnique({
      where: { messageId: 'evolution-image-1' }
    });
    assert.ok(dedup);
    assert.strictEqual((conversationService.handleMessage as any).mock.calls.length, 0);
  });

  test('sends Evolution text without an empty mentions array', async () => {
    mock.method(global, 'fetch', async () => ({ ok: true, status: 200 }));
    const provider = new EvolutionWhatsAppProvider();

    await provider.sendTextMessage('+15551112222', 'hello');

    const [url, options] = (global.fetch as any).mock.calls[0].arguments;
    assert.strictEqual(url, 'https://evolution.example.com/message/sendText/test-instance');
    assert.strictEqual(options.method, 'POST');
    assert.deepStrictEqual(options.headers, {
      apikey: 'test-api-key',
      'Content-Type': 'application/json'
    });
    assert.deepStrictEqual(JSON.parse(options.body), {
      number: '15551112222',
      text: 'hello',
      delay: 0,
      linkPreview: false
    });
    assert.strictEqual('mentioned' in JSON.parse(options.body), false);
    assert.ok(options.signal instanceof AbortSignal);
  });

  test('does not throw on Evolution non-2xx responses', async () => {
    mock.method(global, 'fetch', async () => ({ ok: false, status: 500 }));
    const provider = new EvolutionWhatsAppProvider();

    await assert.doesNotReject(() => provider.sendTextMessage('15551112222@s.whatsapp.net', 'hello'));
    const calls = (console.error as any).mock.calls;
    assert.ok(calls.some((call: any) => call.arguments[0] === 'EvolutionWhatsAppProvider: API error, status: 500'));
    assert.strictEqual(calls.some((call: any) => String(call.arguments[0]).includes('test-api-key')), false);
  });

  test('does not throw on Evolution timeout or network failure', async () => {
    mock.method(global, 'fetch', async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    });
    const provider = new EvolutionWhatsAppProvider();
    await assert.doesNotReject(() => provider.sendTextMessage('15551112222', 'hello'));

    mock.method(global, 'fetch', async () => {
      throw new Error('connection failed with test-api-key');
    });
    await assert.doesNotReject(() => provider.sendTextMessage('15551112222', 'hello'));

    const calls = (console.error as any).mock.calls;
    assert.ok(calls.some((call: any) => call.arguments[0] === 'EvolutionWhatsAppProvider: Request timed out'));
    assert.ok(calls.some((call: any) => call.arguments[0] === 'EvolutionWhatsAppProvider: Error sending message'));
    assert.strictEqual(calls.some((call: any) => String(call.arguments[0]).includes('test-api-key')), false);
  });

  test('normalizes Evolution JIDs and leading plus signs', () => {
    assert.strictEqual(normalizeEvolutionRecipient('+15551112222'), '15551112222');
    assert.strictEqual(normalizeEvolutionRecipient('15551112222'), '15551112222');
    assert.strictEqual(normalizeEvolutionRecipient('+15551112222@s.whatsapp.net'), '15551112222');
    assert.strictEqual(normalizeEvolutionRecipient('15551112222@s.whatsapp.net'), '15551112222');
    assert.strictEqual(normalizeEvolutionRecipient('group@g.us'), 'group');
    assert.strictEqual(normalizeEvolutionRecipient('user@lid'), 'user');
    assert.strictEqual(normalizeEvolutionRecipient('status@broadcast'), 'status');
  });
});

import test from 'node:test';
import assert from 'node:assert';
import { conversationService } from '../src/services/conversationService';
import { env } from '../src/config/env';
import prisma from '../src/db/prisma';

test.describe('N8N Notifier Integration', () => {
  let fetchMock: any;

  test.beforeEach(async () => {
    // Enable n8n
    env.N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/new-lead';
    env.N8N_WEBHOOK_SECRET = 'test-n8n-secret';
    // Clear DB to avoid state leakage
    await prisma.lead.deleteMany();
    await prisma.conversation.deleteMany();
    
    // Mock fetch for all tests
    fetchMock = test.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      status: 200,
      text: async () => 'Workflow executed',
      json: async () => ({ success: true })
    }) as any);
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    env.N8N_WEBHOOK_URL = undefined;
    env.N8N_WEBHOOK_SECRET = undefined;
  });

  // Helper to complete a conversation deterministically
  async function completeConversation(userId: string) {
    await conversationService.handleMessage('simulator', userId, 'hi');
    await conversationService.handleMessage('simulator', userId, '2'); // -> trademark_what
    await conversationService.handleMessage('simulator', userId, '1'); // -> trademark_desc
    await conversationService.handleMessage('simulator', userId, 'My Cool Brand'); // -> trademark_usage
    await conversationService.handleMessage('simulator', userId, '1'); // -> trademark_service
    await conversationService.handleMessage('simulator', userId, '1'); // -> trademark_class
    await conversationService.handleMessage('simulator', userId, 'Class 9'); // -> shared_name
    await conversationService.handleMessage('simulator', userId, 'Jane Doe'); // -> shared_org
    await conversationService.handleMessage('simulator', userId, 'Acme Corp'); // -> shared_email
    await conversationService.handleMessage('simulator', userId, 'jane@acme.com'); // -> shared_mobile
    await conversationService.handleMessage('simulator', userId, '1234567890'); // -> shared_city
    await conversationService.handleMessage('simulator', userId, 'New York'); // -> shared_comm
    await conversationService.handleMessage('simulator', userId, '1'); // -> completes
  }

  test('1. Webhook not called when N8N_WEBHOOK_URL is not set', async (t) => {
    env.N8N_WEBHOOK_URL = undefined;
    await completeConversation('n8n_test_1');
    assert.strictEqual(fetchMock.mock.callCount(), 0);
  });

  test('2. Webhook fires on lead creation with correct payload', async (t) => {
    await completeConversation('n8n_test_2');
    
    assert.strictEqual(fetchMock.mock.callCount(), 1);
    const callArgs = fetchMock.mock.calls[0].arguments;
    const url = callArgs[0] as string;
    const options = callArgs[1] as RequestInit;
    
    assert.strictEqual(url, 'http://localhost:5678/webhook/new-lead');
    assert.strictEqual(options.method, 'POST');
    
    const body = JSON.parse(options.body as string);
    assert.strictEqual(body.event, 'lead.created');
    assert.ok(body.timestamp);
    assert.ok(body.lead.id);
    assert.strictEqual(body.lead.name, 'Jane Doe');
    assert.strictEqual(body.lead.email, 'jane@acme.com');
  });

  test('3. Webhook sends X-Webhook-Secret header', async (t) => {
    await completeConversation('n8n_test_3');
    
    assert.strictEqual(fetchMock.mock.callCount(), 1);
    const options = fetchMock.mock.calls[0].arguments[1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    
    assert.strictEqual(headers['X-Webhook-Secret'], 'test-n8n-secret');
    assert.strictEqual(headers['Content-Type'], 'application/json');
  });

  test('4. Webhook failure does not crash the backend', async (t) => {
    fetchMock.mock.restore();
    fetchMock = test.mock.method(globalThis, 'fetch', async () => {
      throw new Error('Network failure');
    });

    // Should not throw
    await completeConversation('n8n_test_4');
    assert.strictEqual(fetchMock.mock.callCount(), 1);
  });

  test('5. Webhook failure does not block customer response', async (t) => {
    fetchMock.mock.restore();
    fetchMock = test.mock.method(globalThis, 'fetch', async () => {
      // Simulate slow response
      await new Promise(resolve => setTimeout(resolve, 50));
      return { ok: false, status: 500 } as any;
    });

    const start = Date.now();
    await completeConversation('n8n_test_5');
    const elapsed = Date.now() - start;
    
    // Process should complete quickly without waiting for the timeout or being blocked heavily
    assert.ok(elapsed < 2000, `Took ${elapsed}ms, should be fast fire-and-forget`);
    assert.strictEqual(fetchMock.mock.callCount(), 1);
  });

  test('6. Payload contains expected lead fields', async (t) => {
    await completeConversation('n8n_test_6');
    
    const body = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
    const lead = body.lead;
    
    assert.ok(lead.conversationId);
    assert.strictEqual(lead.flowType, 'trademark');
    assert.strictEqual(lead.organization, 'Acme Corp');
    assert.strictEqual(lead.mobile, '1234567890');
    assert.strictEqual(lead.city, 'New York');
    assert.strictEqual(lead.preferredComm, '1');
    assert.strictEqual(lead.phoneCallTime, null);
    assert.ok(lead.answers);
    assert.strictEqual(lead.answers.trademark_what, '1');
    assert.ok(lead.createdAt);
  });

  test('7. Payload does NOT contain secrets', async (t) => {
    env.AI_API_KEY = 'TEST_ONLY_NOT_A_SECRET';
    await completeConversation('n8n_test_7');
    
    const bodyString = fetchMock.mock.calls[0].arguments[1].body;
    assert.ok(!bodyString.includes('test-n8n-secret'));
    assert.ok(!bodyString.includes('TEST_ONLY_NOT_A_SECRET'));
    
    env.AI_API_KEY = undefined;
  });

  test('8. Webhook not called for incomplete conversations', async (t) => {
    await conversationService.handleMessage('simulator', 'n8n_test_8', '2'); // trademark
    await conversationService.handleMessage('simulator', 'n8n_test_8', '1'); // brand name
    
    // Conversation is not complete yet
    assert.strictEqual(fetchMock.mock.callCount(), 0);
  });
});

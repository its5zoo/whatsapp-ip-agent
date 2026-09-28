import test from 'node:test';
import assert from 'node:assert';
import { conversationService } from '../src/services/conversationService';
import { aiFallbackService } from '../src/ai/aiFallbackService';
import prisma from '../src/db/prisma';
import { env } from '../src/config/env';

import { aiProvider } from '../src/ai/aiProvider';

test.describe('AI Fallback', () => {
  test.beforeEach(async () => {
    env.AI_API_KEY = 'test-api-key';
    env.AI_CONFIDENCE_THRESHOLD = 0.8;
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    env.AI_API_KEY = undefined;
  });

  test('1. Valid numbered input does NOT invoke AI', async (t) => {
    const mockCallGemini = test.mock.method(aiProvider, 'callGemini');
    
    await conversationService.handleMessage('simulator', 'test_user_1', '1');
    
    assert.strictEqual(mockCallGemini.mock.callCount(), 0);
  });

  test('2. Global command (HELP) does NOT invoke AI', async (t) => {
    const mockCallGemini = test.mock.method(aiProvider, 'callGemini');
    
    await conversationService.handleMessage('simulator', 'test_user_2', 'HELP');
    
    assert.strictEqual(mockCallGemini.mock.callCount(), 0);
  });

  test('3. Free-text question does NOT invoke AI', async (t) => {
    // Navigate to a free text question (trademark_desc)
    await conversationService.handleMessage('simulator', 'test_user_3', '2'); // Trademark
    await conversationService.handleMessage('simulator', 'test_user_3', '1'); // Brand Name
    
    const mockCallGemini = test.mock.method(aiProvider, 'callGemini');
    
    // Provide free text
    const response = await conversationService.handleMessage('simulator', 'test_user_3', 'My cool brand');
    
    assert.strictEqual(mockCallGemini.mock.callCount(), 0);
    assert.ok(response.includes('Q4. Have you already started using the trademark?'));
  });

  test('4. Unrecognized input on choice question triggers AI', async (t) => {
    const mockCallGemini = test.mock.method(aiProvider, 'callGemini', async () => ({
      optionId: '2',
      confidence: 0.9
    }));
    
    await conversationService.handleMessage('simulator', 'test_user_4', 'I want to protect my brand name');
    
    assert.strictEqual(mockCallGemini.mock.callCount(), 1);
  });

  test('5. High-confidence AI result maps correctly', async (t) => {
    test.mock.method(aiProvider, 'callGemini', async () => ({
      optionId: '2',
      confidence: 0.95
    }));
    
    const response = await conversationService.handleMessage('simulator', 'test_user_5', 'brand');
    
    assert.ok(response.includes('Q2. What do you want to protect?')); // trademark_what
  });

  test('6. Low-confidence AI result does not guess', async (t) => {
    test.mock.method(aiProvider, 'callGemini', async () => ({
      optionId: '2',
      confidence: 0.5
    }));
    
    const response = await conversationService.handleMessage('simulator', 'test_user_6', 'brand');
    
    assert.ok(response.includes('Invalid option.'));
    assert.ok(response.includes('Q1. What type of IP protection are you looking for?'));
  });

  test('7. AI returns UNKNOWN', async (t) => {
    test.mock.method(aiProvider, 'callGemini', async () => ({
      optionId: 'UNKNOWN',
      confidence: 0.0
    }));
    
    const response = await conversationService.handleMessage('simulator', 'test_user_7', 'who are you?');
    
    assert.ok(response.includes('Invalid option.'));
  });

  test('8. AI returns invalid optionId for current question', async (t) => {
    test.mock.method(aiProvider, 'callGemini', async () => ({
      optionId: '99',
      confidence: 0.95
    }));
    
    const response = await conversationService.handleMessage('simulator', 'test_user_8', 'hello');
    
    assert.ok(response.includes('Invalid option.'));
  });

  test('9. AI timeout (null return)', async (t) => {
    test.mock.method(aiProvider, 'callGemini', async () => null);
    
    const response = await conversationService.handleMessage('simulator', 'test_user_9', 'hello');
    
    assert.ok(response.includes('Invalid option.'));
  });

  test('10. AI returns confidence outside [0.0, 1.0]', async (t) => {
    test.mock.method(aiProvider, 'callGemini', async () => ({
      optionId: '1',
      confidence: 1.5
    }));
    
    const response = await conversationService.handleMessage('simulator', 'test_user_10', 'patent');
    
    assert.ok(response.includes('Invalid option.'));
  });

  test('11. AI completely disabled (no API key)', async (t) => {
    env.AI_API_KEY = undefined;
    const mockCallGemini = test.mock.method(aiProvider, 'callGemini');
    
    const response = await conversationService.handleMessage('simulator', 'test_user_11', 'I want to protect my brand name');
    
    assert.strictEqual(mockCallGemini.mock.callCount(), 0);
    assert.ok(response.includes('Invalid option.'));
  });

});

import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert';
import prisma from '../src/db/prisma';
import { conversationService } from '../src/services/conversationService';

// Test safety guard
if (!process.env.DATABASE_URL?.includes('_test')) {
  console.error('Refusing to run tests: DATABASE_URL does not point to a test database');
  process.exit(1);
}

describe('Conversation Continuity', () => {
  const now = new Date('2026-09-30T00:00:00.000Z');
  const setUpdatedAt = async (externalUserId: string, ageMs: number) => {
    const conversation = await prisma.conversation.findFirst({ where: { externalUserId } });
    await prisma.conversation.update({
      where: { id: conversation!.id },
      data: { updatedAt: new Date(now.getTime() - ageMs) }
    });
  };

  before(async () => {
    await prisma.lead.deleteMany({});
    await prisma.conversation.deleteMany({});
  });

  after(async () => {
    await prisma.$disconnect();
  });

  test('1. Scenario 1: New Customer gets welcome message and Q1', async () => {
    const res = await conversationService.handleMessage('simulator', 'cont1', 'hi', now);
    assert.ok(res.includes('Welcome to GenioBrain IP Solution!'));
    assert.ok(res.includes('Q1. What type of IP protection are you looking for?'));
  });

  test('2. Scenario 2: Incomplete <24h normal continuation', async () => {
    // Normal progress
    const res = await conversationService.handleMessage('simulator', 'cont1', '1', now);
    assert.ok(res.includes('Q2. What best describes your invention?'));
  });

  test('3. Scenario 3: Incomplete >=24h shows summary prompt', async () => {
    const conv = await prisma.conversation.findFirst({ where: { externalUserId: 'cont1' } });
    // time travel 25 hours
    await setUpdatedAt('cont1', 25 * 60 * 60 * 1000);

    const res = await conversationService.handleMessage('simulator', 'cont1', 'hello', now);
    assert.ok(res.includes('Welcome back'));
    assert.ok(res.includes('- IP Type: Patent'));
    assert.ok(res.includes('1. Continue previous enquiry'));
  });

  test('4. Scenario 4: Continue incomplete enquiry (choice 1)', async () => {
    const res = await conversationService.handleMessage('simulator', 'cont1', '1', now);
    // Should re-prompt Q2
    assert.ok(res.includes('Q2. What best describes your invention?'));
    
    // Answering Q2 progresses normally
    const nextRes = await conversationService.handleMessage('simulator', 'cont1', '2', now);
    assert.ok(nextRes.includes('Q3. What stage is your invention currently at?'));
  });

  test('5. Scenario 5: Start new enquiry (choice 2) from incomplete', async () => {
    // Force >= 24h again to get prompt
    const conv = await prisma.conversation.findFirst({ where: { externalUserId: 'cont1' } });
    await setUpdatedAt('cont1', 25 * 60 * 60 * 1000);

    await conversationService.handleMessage('simulator', 'cont1', 'hi', now); // get prompt
    const res = await conversationService.handleMessage('simulator', 'cont1', '2', now);
    
    // Should start fresh without welcome
    assert.ok(!res.includes('Welcome to GenioBrain IP Solution!')); // Does not show initial welcome, just Q1
    assert.ok(res.includes('Q1. What type of IP protection are you looking for?'));
    
    // Check that data is cleared
    const updatedConv = await prisma.conversation.findUnique({ where: { id: conv!.id } });
    assert.deepStrictEqual(updatedConv!.data, {});
  });

  test('6. Scenario 8: Global commands bypass >=24h prompt', async () => {
    // Force >= 24h
    const conv = await prisma.conversation.findFirst({ where: { externalUserId: 'cont1' } });
    await setUpdatedAt('cont1', 25 * 60 * 60 * 1000);

    const res = await conversationService.handleMessage('simulator', 'cont1', 'HELP', now);
    assert.ok(res.includes('HELP – Speak to our team'));
    assert.ok(!res.includes('Welcome back'));
  });

  test('7. Completed conversation prompts again for a normal message regardless of age', async () => {
    await prisma.conversation.create({
      data: {
        channel: 'simulator',
        externalUserId: 'completed1',
        isCompleted: true,
        data: {
          flowType: 'patent',
          shared_name: 'Completed User',
          shared_email: 'completed@example.com'
        }
      }
    });

    const conv = await prisma.conversation.findFirst({ where: { externalUserId: 'completed1' } });
    await prisma.lead.create({
      data: {
        conversationId: conv!.id,
        name: 'Completed User',
        organization: '',
        email: 'completed@example.com',
        mobile: '',
        city: '',
        preferredComm: '',
        flowType: 'patent',
        answers: conv!.data as any
      }
    });

    const res = await conversationService.handleMessage('simulator', 'completed1', 'Okay', now);
    assert.strictEqual(res, `You have already submitted an enquiry with GenioBrain IP Solution.

Would you like to submit a new enquiry?

1. Yes – Start a new enquiry
2. No – Keep my existing enquiry`);
    const updated = await prisma.conversation.findUnique({ where: { id: conv!.id } });
    assert.deepStrictEqual((updated!.data as any)._conversationMeta, { continuityPrompt: 'completed' });
    assert.strictEqual(await prisma.lead.count({ where: { conversationId: conv!.id } }), 1);
  });

  test('8. Completed prompt option 1 starts a new enquiry without creating a Lead', async () => {
    const res = await conversationService.handleMessage('simulator', 'completed1', '1', now);
    assert.ok(res.includes('Q1. What type of IP protection are you looking for?'));
    const conv = await prisma.conversation.findFirst({ where: { externalUserId: 'completed1' } });
    assert.strictEqual(conv!.isCompleted, false);
    assert.strictEqual(conv!.currentQuestionId, 'main_menu');
    assert.strictEqual(await prisma.lead.count({ where: { conversationId: conv!.id } }), 1);
  });

  test('9. Completed prompt option 2 keeps the existing enquiry', async () => {
    // Reset state
    const conv = await prisma.conversation.findFirst({ where: { externalUserId: 'completed1' } });
    await prisma.conversation.update({
      where: { id: conv!.id },
      data: { isCompleted: true }
    });
    await setUpdatedAt('completed1', 25 * 60 * 60 * 1000);
    
    await conversationService.handleMessage('simulator', 'completed1', 'hi', now); // Get prompt

    const res = await conversationService.handleMessage('simulator', 'completed1', '2', now);
    assert.strictEqual(res, 'Your existing enquiry will be kept. Our team can help with it if needed.');
    const updated = await prisma.conversation.findUnique({ where: { id: conv!.id } });
    assert.strictEqual(updated!.isCompleted, true);
    assert.strictEqual((updated!.data as any)._conversationMeta, undefined);
    assert.strictEqual(await prisma.lead.count({ where: { conversationId: conv!.id } }), 1);
  });

  test('10. Exact boundary and safe summary exclusions', async () => {
    await prisma.conversation.create({
      data: {
        channel: 'simulator',
        externalUserId: 'boundary1',
        currentQuestionId: 'patent_type',
        data: {
          flowType: 'patent',
          patent_desc: 'confidential invention',
          shared_email: 'private@example.com',
          _conversationMeta: { continuityPrompt: 'invalid' }
        } as any,
        isCompleted: false,
        updatedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }
    });

    const res = await conversationService.handleMessage('simulator', 'boundary1', 'hello', now);
    assert.ok(res.includes('Welcome back'));
    assert.ok(res.includes('- IP Type: Patent'));
    assert.ok(!res.includes('confidential invention'));
    assert.ok(!res.includes('private@example.com'));
    assert.ok(!res.includes('_conversationMeta'));
  });

  test('11. Invalid pending choice repeats prompt without AI or data leakage', async () => {
    const res = await conversationService.handleMessage('simulator', 'boundary1', 'not a choice', now);
    assert.ok(res.startsWith('Invalid choice. Please reply with 1 or 2.'));
    assert.ok(res.includes('1. Continue previous enquiry'));
    assert.ok(!res.includes('confidential invention'));
    assert.ok(!res.includes('private@example.com'));
  });

  test('12. Global commands clear stale continuity prompts', async () => {
    const cases = [
      { command: 'BACK', expectedResponse: 'Q1. What type of IP protection are you looking for?', nextAnswer: 'Q2. What best describes your invention?' },
      { command: 'HELP', expectedResponse: 'HELP – Speak to our team', nextAnswer: 'Q3. What stage is your invention currently at?' },
      { command: 'SERVICES', expectedResponse: 'SERVICES – Explore our IP services', nextAnswer: 'Q3. What stage is your invention currently at?' },
      { command: 'CONSULTATION', expectedResponse: 'CONSULTATION – Request a consultation', nextAnswer: 'Q3. What stage is your invention currently at?' }
    ];

    for (const [index, testCase] of cases.entries()) {
      const externalUserId = `stale-command-${index}`;
      await prisma.conversation.create({
        data: {
          channel: 'simulator',
          externalUserId,
          currentQuestionId: 'patent_type',
          data: { flowType: 'patent' },
          isCompleted: false,
          updatedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000)
        }
      });

      const commandResponse = await conversationService.handleMessage(
        'simulator',
        externalUserId,
        testCase.command,
        now
      );
      assert.ok(commandResponse.includes(testCase.expectedResponse));

      const conversation = await prisma.conversation.findUnique({
        where: { channel_externalUserId: { channel: 'simulator', externalUserId } }
      });
      assert.deepStrictEqual(conversation?.data, { flowType: 'patent' });

      const nextResponse = await conversationService.handleMessage(
        'simulator',
        externalUserId,
        '1',
        now
      );
      assert.ok(nextResponse.includes(testCase.nextAnswer));
      assert.ok(!nextResponse.includes('Continue previous enquiry'));
    }
  });

});

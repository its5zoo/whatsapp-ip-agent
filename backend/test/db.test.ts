import { test, describe, before, after, mock } from 'node:test';
import * as assert from 'node:assert';
import prisma from '../src/db/prisma';
import { conversationService } from '../src/services/conversationService';
import { leadRepository } from '../src/db/repositories/leadRepository';

// Test safety guard
if (!process.env.DATABASE_URL?.includes('_test')) {
  console.error('Refusing to run tests: DATABASE_URL does not point to a test database');
  process.exit(1);
}

describe('Database and Service Layer Integration', () => {

  before(async () => {
    await prisma.lead.deleteMany({});
    await prisma.conversation.deleteMany({});
  });

  after(async () => {
    await prisma.$disconnect();
  });

  test('1. Prisma connects to test DB', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    assert.deepStrictEqual(result, [{ result: 1 }]);
  });

  test('2. Conversation creation via service', async () => {
    await conversationService.handleMessage('simulator', 'user1', 'hi');
    const res = await conversationService.handleMessage('simulator', 'user1', 'hi'); // invalid input for main menu
    assert.ok(res.includes('Invalid option'));

    const conv = await prisma.conversation.findUnique({
      where: { channel_externalUserId: { channel: 'simulator', externalUserId: 'user1' } }
    });
    
    assert.ok(conv);
    assert.strictEqual(conv.channel, 'simulator');
    assert.strictEqual(conv.externalUserId, 'user1');
    assert.strictEqual(conv.currentQuestionId, 'main_menu');
    assert.strictEqual(conv.isCompleted, false);
  });

  test('3. Conversation lookup by channel + externalUserId', async () => {
    // Should reuse the same conversation
    const res = await conversationService.handleMessage('simulator', 'user1', '1'); // Select Patent
    assert.ok(res.includes('What best describes your invention?'));

    const convs = await prisma.conversation.findMany({
      where: { channel: 'simulator', externalUserId: 'user1' }
    });
    
    assert.strictEqual(convs.length, 1);
    assert.strictEqual(convs[0].currentQuestionId, 'patent_type');
  });

  test('4. Missing conversation returns null (handled by service creating it)', async () => {
    await conversationService.handleMessage('simulator', 'user2', 'hi');
    const res = await conversationService.handleMessage('simulator', 'user2', '1');
    const conv = await prisma.conversation.findUnique({
      where: { channel_externalUserId: { channel: 'simulator', externalUserId: 'user2' } }
    });
    assert.ok(conv);
    assert.strictEqual(conv.currentQuestionId, 'patent_type');
  });

  test('5. Conversation state update and JSONB data survives persistence', async () => {
    // Continue user2
    await conversationService.handleMessage('simulator', 'user2', '1'); // Pharmaceutical
    const conv = await prisma.conversation.findUnique({
      where: { channel_externalUserId: { channel: 'simulator', externalUserId: 'user2' } }
    });
    assert.strictEqual(conv!.currentQuestionId, 'patent_stage');
    assert.strictEqual((conv!.data as any)['patent_type'], '1');
  });

  test('7. Lead creation through upsert & 9. Lead -> Conversation relationship & 11. Full lifecycle', async () => {
    // Complete user2 flow
    await conversationService.handleMessage('simulator', 'user2', '1'); // stage
    await conversationService.handleMessage('simulator', 'user2', '1'); // service
    await conversationService.handleMessage('simulator', 'user2', 'My invention desc'); // desc
    
    await conversationService.handleMessage('simulator', 'user2', 'John'); // name
    await conversationService.handleMessage('simulator', 'user2', 'Acme'); // org
    await conversationService.handleMessage('simulator', 'user2', 'john@acme.com'); // email
    await conversationService.handleMessage('simulator', 'user2', '123456'); // mobile
    await conversationService.handleMessage('simulator', 'user2', 'New York'); // city
    
    // Choose Email for comms to finish directly
    const res = await conversationService.handleMessage('simulator', 'user2', '3'); 
    
    assert.ok(res.includes('Thank you for sharing your requirement'));

    // Check conversation is completed
    const conv = await prisma.conversation.findUnique({
      where: { channel_externalUserId: { channel: 'simulator', externalUserId: 'user2' } },
      include: { lead: true }
    });

    assert.strictEqual(conv!.isCompleted, true);
    assert.strictEqual(conv!.currentQuestionId, null);
    
    // Check lead created
    const lead = conv!.lead;
    assert.ok(lead);
    assert.strictEqual(lead.name, 'John');
    assert.strictEqual(lead.organization, 'Acme');
    assert.strictEqual(lead.email, 'john@acme.com');
    assert.strictEqual(lead.mobile, '123456');
    assert.strictEqual(lead.city, 'New York');
    assert.strictEqual(lead.preferredComm, '3');
    assert.strictEqual(lead.phoneCallTime, null);
    assert.strictEqual(lead.flowType, 'patent');
  });

  test('8. Repeated Lead upsert does not duplicate', async () => {
    const beforeCount = await prisma.lead.count();

    const conv = await prisma.conversation.findUnique({
      where: { channel_externalUserId: { channel: 'simulator', externalUserId: 'user2' } }
    });

    // Manually trigger upsert again
    const { leadRepository } = require('../src/db/repositories/leadRepository');
    await leadRepository.upsertFromConversation(conv!.id, {
      name: 'John Updated',
      organization: 'Acme',
      email: 'john@acme.com',
      mobile: '123456',
      city: 'New York',
      preferredComm: '3',
      phoneCallTime: null,
      flowType: 'patent',
      answers: {}
    });

    const afterCount = await prisma.lead.count();
    assert.strictEqual(beforeCount, afterCount);

    const lead = await prisma.lead.findUnique({
      where: { conversationId: conv!.id }
    });
    assert.strictEqual(lead!.name, 'John Updated');
  });

  test('8a. Completed conversation repairs a Lead after transient persistence failure', async () => {
    const externalUserId = 'lead-recovery-user';
    const conversation = await prisma.conversation.create({
      data: {
        channel: 'simulator',
        externalUserId,
        currentQuestionId: 'shared_comm',
        data: {
          flowType: 'patent',
          shared_name: 'Recovery User',
          shared_org: 'Recovery Org',
          shared_email: 'recovery@example.com',
          shared_mobile: '123456',
          shared_city: 'New York'
        },
        isCompleted: false
      }
    });
    const originalUpsert = leadRepository.upsertFromConversation.bind(leadRepository);
    let shouldFail = true;
    mock.method(leadRepository, 'upsertFromConversation', async (...args) => {
      if (shouldFail) {
        shouldFail = false;
        throw new Error('temporary lead persistence failure');
      }
      return originalUpsert(...args);
    });

    await assert.rejects(
      conversationService.handleMessage('simulator', externalUserId, '3'),
      /temporary lead persistence failure/
    );

    const failedConversation = await prisma.conversation.findUnique({
      where: { id: conversation.id }
    });
    assert.strictEqual(failedConversation?.isCompleted, false);
    assert.strictEqual(await prisma.lead.findUnique({ where: { conversationId: conversation.id } }), null);

    await conversationService.handleMessage('simulator', externalUserId, '3');
    const recoveredLead = await prisma.lead.findUnique({
      where: { conversationId: conversation.id }
    });
    assert.strictEqual(recoveredLead?.email, 'recovery@example.com');
    mock.restoreAll();
  });

  test('13. Concurrent first messages serialize into one conversation', async () => {
    const userId = 'concurrent-first-user';
    await Promise.all([
      conversationService.handleMessage('simulator', userId, 'hi'),
      conversationService.handleMessage('simulator', userId, 'HELP')
    ]);

    const conversations = await prisma.conversation.findMany({
      where: { channel: 'simulator', externalUserId: userId }
    });
    assert.strictEqual(conversations.length, 1);
    assert.strictEqual(conversations[0].currentQuestionId, 'main_menu');
  });

  test('14. Concurrent existing messages preserve a serialized state transition', async () => {
    const userId = 'concurrent-existing-user';
    await conversationService.handleMessage('simulator', userId, 'hi');

    await Promise.all([
      conversationService.handleMessage('simulator', userId, '1'),
      conversationService.handleMessage('simulator', userId, '2')
    ]);

    const conversation = await prisma.conversation.findUnique({
      where: { channel_externalUserId: { channel: 'simulator', externalUserId: userId } }
    });
    assert.ok(conversation);
    assert.ok(conversation.currentQuestionId !== 'main_menu');
    assert.ok(['patent', 'trademark'].includes((conversation.data as any).flowType));
  });

  test('15. Concurrent completion creates one consistent Lead', async () => {
    const userId = 'concurrent-completion-user';
    const conversation = await prisma.conversation.create({
      data: {
        channel: 'simulator',
        externalUserId: userId,
        currentQuestionId: 'shared_comm',
        data: {
          flowType: 'patent',
          shared_name: 'Concurrent User',
          shared_org: 'Concurrent Org',
          shared_email: 'concurrent@example.com',
          shared_mobile: '123456',
          shared_city: 'New York'
        },
        isCompleted: false
      }
    });

    await Promise.all([
      conversationService.handleMessage('simulator', userId, '3'),
      conversationService.handleMessage('simulator', userId, 'HELP')
    ]);

    const completed = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: { lead: true }
    });
    assert.strictEqual(completed?.isCompleted, true);
    assert.ok(completed?.lead);
    assert.strictEqual(await prisma.lead.count({ where: { conversationId: conversation.id } }), 1);
  });

  test('10. Duplicate conversation identity is rejected', async () => {
    const { conversationRepository } = require('../src/db/repositories/conversationRepository');
    
    await assert.rejects(async () => {
      await conversationRepository.create('simulator', 'user2');
    }, /Unique constraint failed/);
  });

  test('12. Completed conversation receives a new message and restarts exactly as the existing engine dictates', async () => {
    // user2 is currently completed
    const convBefore = await prisma.conversation.findUnique({
      where: { channel_externalUserId: { channel: 'simulator', externalUserId: 'user2' } }
    });
    assert.strictEqual(convBefore!.isCompleted, true);

    // Send new message
    const res = await conversationService.handleMessage('simulator', 'user2', '2'); // Trademark
    assert.ok(res.includes('What do you want to protect?')); // Re-entered flow

    const convAfter = await prisma.conversation.findUnique({
      where: { channel_externalUserId: { channel: 'simulator', externalUserId: 'user2' } }
    });
    
    assert.strictEqual(convAfter!.isCompleted, false);
    assert.strictEqual(convAfter!.currentQuestionId, 'trademark_what');
    assert.strictEqual((convAfter!.data as any)['flowType'], 'trademark');
  });

});

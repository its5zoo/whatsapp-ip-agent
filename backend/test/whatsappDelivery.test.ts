import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import * as assert from 'node:assert';
import prisma from '../src/db/prisma';
import { conversationService } from '../src/services/conversationService';
import { leadRepository } from '../src/db/repositories/leadRepository';
import { WhatsappDeliveryService } from '../src/services/whatsappDeliveryService';
import type { WhatsAppProvider } from '../src/whatsapp/providers/types';
import { waitFor } from './testUtils';

if (!process.env.DATABASE_URL?.includes('_test')) {
  console.error('Refusing to run tests: DATABASE_URL does not point to a test database');
  process.exit(1);
}

const provider = (sendTextMessage: WhatsAppProvider['sendTextMessage']): WhatsAppProvider => ({
  name: 'meta',
  verifyInboundChallenge: () => false,
  verifyInboundSignature: () => false,
  verifyWebhookSecret: () => false,
  parseInbound: () => [],
  sendTextMessage
});

describe('WhatsApp outbound delivery', () => {
  let whatsappDeliveryService: WhatsappDeliveryService;

  before(async () => {
    await prisma.whatsappOutboundMessage.deleteMany({});
    await prisma.processedWhatsappMessage.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.conversation.deleteMany({});
  });

  beforeEach(async () => {
    whatsappDeliveryService = new WhatsappDeliveryService();
    await prisma.whatsappOutboundMessage.deleteMany({});
    await prisma.processedWhatsappMessage.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.conversation.deleteMany({});
  });

  afterEach(async () => {
    await whatsappDeliveryService.stop();
    mock.restoreAll();
  });

  after(async () => {
    await prisma.$disconnect();
  });

  test('successful processing creates exactly one pending outbound record', async () => {
    await conversationService.handleMessage('whatsapp', 'outbox-user-1', 'hello', new Date(), 'outbox-in-1');

    const records = await prisma.whatsappOutboundMessage.findMany({
      where: { inboundMessageId: 'outbox-in-1' }
    });
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].status, 'pending');
    assert.ok(records[0].text.includes('Welcome to GenioBrain IP Solution!'));
  });

  test('conversation failure rolls back inbound deduplication and outbound record', async () => {
    const conversation = await prisma.conversation.create({
      data: {
        channel: 'whatsapp',
        externalUserId: 'outbox-failure-user',
        currentQuestionId: 'shared_comm',
        data: {
          flowType: 'patent',
          shared_name: 'Test',
          shared_org: 'Org',
          shared_email: 'test@example.com',
          shared_mobile: '123',
          shared_city: 'City'
        },
        isCompleted: false
      }
    });
    mock.method(leadRepository, 'upsertFromConversation', async () => {
      throw new Error('temporary lead failure');
    });

    await assert.rejects(
      conversationService.handleMessage(
        'whatsapp',
        conversation.externalUserId,
        '1',
        new Date(),
        'outbox-failure-in'
      ),
      /temporary lead failure/
    );
    assert.strictEqual(await prisma.processedWhatsappMessage.count({
      where: { messageId: 'outbox-failure-in' }
    }), 0);
    assert.strictEqual(await prisma.whatsappOutboundMessage.count({
      where: { inboundMessageId: 'outbox-failure-in' }
    }), 0);
  });

  test('successful provider send marks sent and duplicate delivery does not resend', async () => {
    await conversationService.handleMessage('whatsapp', 'outbox-user-2', 'hello', new Date(), 'outbox-in-2');
    let calls = 0;
    whatsappDeliveryService.start(provider(async () => {
      calls++;
      return { outcome: 'accepted' };
    }));

    await whatsappDeliveryService.deliverByInboundMessageId('outbox-in-2');
    await whatsappDeliveryService.deliverByInboundMessageId('outbox-in-2');

    const record = await prisma.whatsappOutboundMessage.findUnique({
      where: { inboundMessageId: 'outbox-in-2' }
    });
    assert.strictEqual(record?.status, 'sent');
    assert.strictEqual(calls, 1);
  });

  test('retryable and unknown outcomes are scheduled for retry', async () => {
    await conversationService.handleMessage('whatsapp', 'outbox-user-3', 'hello', new Date(), 'outbox-in-3');
    whatsappDeliveryService.start(provider(async () => ({
      outcome: 'unknown',
      error: 'timeout'
    })));

    await whatsappDeliveryService.deliverByInboundMessageId('outbox-in-3');
    await waitFor(async () => {
      const current = await prisma.whatsappOutboundMessage.findUnique({
        where: { inboundMessageId: 'outbox-in-3' }
      });
      return current?.status === 'retryable';
    });
    const record = await prisma.whatsappOutboundMessage.findUnique({
      where: { inboundMessageId: 'outbox-in-3' }
    });
    assert.strictEqual(record?.status, 'retryable');
    assert.strictEqual(record?.attempts, 1);
    assert.ok(record?.nextAttemptAt && record.nextAttemptAt > new Date());
  });

  test('explicit retryable provider failures are scheduled for retry', async () => {
    await conversationService.handleMessage('whatsapp', 'outbox-user-3b', 'hello', new Date(), 'outbox-in-3b');
    whatsappDeliveryService.start(provider(async () => ({
      outcome: 'failed',
      retryable: true,
      error: 'provider unavailable'
    })));

    await whatsappDeliveryService.deliverByInboundMessageId('outbox-in-3b');
    const record = await prisma.whatsappOutboundMessage.findUnique({
      where: { inboundMessageId: 'outbox-in-3b' }
    });
    assert.strictEqual(record?.status, 'retryable');
    assert.strictEqual(record?.lastError, 'provider unavailable');
  });

  test('stale sending lease is reclaimed', async () => {
    await prisma.whatsappOutboundMessage.create({
      data: {
        inboundMessageId: 'outbox-stale-in',
        waId: 'stale-user',
        text: 'retry me',
        status: 'sending',
        attempts: 1,
        sendingAt: new Date(Date.now() - 120_000)
      }
    });
    let calls = 0;
    whatsappDeliveryService.start(provider(async () => {
      calls++;
      return { outcome: 'accepted' };
    }));

    await whatsappDeliveryService.deliverByInboundMessageId('outbox-stale-in');
    const record = await prisma.whatsappOutboundMessage.findUnique({
      where: { inboundMessageId: 'outbox-stale-in' }
    });
    assert.strictEqual(record?.status, 'sent');
    assert.strictEqual(record?.attempts, 2);
    assert.strictEqual(calls, 1);
  });

  test('concurrent duplicate inbound deliveries create one record and one claim', async () => {
    await Promise.all([
      conversationService.handleMessage('whatsapp', 'outbox-user-4', 'hello', new Date(), 'outbox-in-4'),
      conversationService.handleMessage('whatsapp', 'outbox-user-4', 'hello', new Date(), 'outbox-in-4')
    ]);
    assert.strictEqual(await prisma.whatsappOutboundMessage.count({
      where: { inboundMessageId: 'outbox-in-4' }
    }), 1);

    let calls = 0;
    whatsappDeliveryService.start(provider(async () => {
      calls++;
      await new Promise(resolve => setTimeout(resolve, 20));
      return { outcome: 'accepted' };
    }));
    await Promise.all([
      whatsappDeliveryService.deliverByInboundMessageId('outbox-in-4'),
      whatsappDeliveryService.deliverByInboundMessageId('outbox-in-4')
    ]);
    assert.strictEqual(calls, 1);
  });

  test('dispatches independent outbound records concurrently', async () => {
    await conversationService.handleMessage('whatsapp', 'outbox-user-5', 'hello', new Date(), 'outbox-in-5');
    await conversationService.handleMessage('whatsapp', 'outbox-user-6', 'hello', new Date(), 'outbox-in-6');

    let activeCalls = 0;
    let maximumActiveCalls = 0;
    whatsappDeliveryService.start(provider(async () => {
      activeCalls += 1;
      maximumActiveCalls = Math.max(maximumActiveCalls, activeCalls);
      await new Promise(resolve => setTimeout(resolve, 20));
      activeCalls -= 1;
      return { outcome: 'accepted' };
    }));

    await Promise.all([
      whatsappDeliveryService.deliverByInboundMessageId('outbox-in-5'),
      whatsappDeliveryService.deliverByInboundMessageId('outbox-in-6')
    ]);

    assert.strictEqual(maximumActiveCalls, 2);
    const records = await prisma.whatsappOutboundMessage.findMany({
      where: { inboundMessageId: { in: ['outbox-in-5', 'outbox-in-6'] } }
    });
    assert.deepStrictEqual(records.map(record => record.status).sort(), ['sent', 'sent']);
  });

  test('delivers an independent row while another send is active', async () => {
    await conversationService.handleMessage('whatsapp', 'outbox-user-7', 'hello', new Date(), 'outbox-in-7');
    await conversationService.handleMessage('whatsapp', 'outbox-user-8', 'hello', new Date(), 'outbox-in-8');

    let firstStartedResolve!: () => void;
    const firstStarted = new Promise<void>(resolve => {
      firstStartedResolve = resolve;
    });
    let releaseFirstSend!: () => void;
    const firstSend = new Promise<void>(resolve => {
      releaseFirstSend = resolve;
    });
    let calls = 0;
    whatsappDeliveryService.start(provider(async (waId) => {
      calls += 1;
      if (waId === 'outbox-user-7') {
        firstStartedResolve();
        await firstSend;
      }
      return { outcome: 'accepted' };
    }));

    const firstDelivery = whatsappDeliveryService.deliverByInboundMessageId('outbox-in-7');
    await firstStarted;
    await whatsappDeliveryService.deliverByInboundMessageId('outbox-in-8');
    assert.strictEqual(calls, 2);

    releaseFirstSend();
    await firstDelivery;
  });

  test('shutdown waits for an active send and its final status update', async () => {
    await conversationService.handleMessage('whatsapp', 'outbox-user-9', 'hello', new Date(), 'outbox-in-9');

    let releaseSend!: () => void;
    const sendStarted = new Promise<void>(resolve => {
      releaseSend = resolve;
    });
    let sendStartedObserved!: () => void;
    const started = new Promise<void>(resolve => {
      sendStartedObserved = resolve;
    });
    whatsappDeliveryService.start(provider(async () => {
      sendStartedObserved();
      await sendStarted;
      return { outcome: 'accepted' };
    }));

    const delivery = whatsappDeliveryService.deliverByInboundMessageId('outbox-in-9');
    await started;
    let stopped = false;
    const stopping = whatsappDeliveryService.stop().then(() => {
      stopped = true;
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.strictEqual(stopped, false);

    releaseSend();
    await Promise.all([delivery, stopping]);
    const record = await prisma.whatsappOutboundMessage.findUnique({
      where: { inboundMessageId: 'outbox-in-9' }
    });
    assert.strictEqual(record?.status, 'sent');
  });
});

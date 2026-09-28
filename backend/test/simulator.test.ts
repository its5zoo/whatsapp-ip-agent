import { test, describe, before, after } from 'node:test';
import * as assert from 'node:assert';
import { buildApp } from '../src/app';
import prisma from '../src/db/prisma';

// Test safety guard
if (!process.env.DATABASE_URL?.includes('_test')) {
  console.error('Refusing to run tests: DATABASE_URL does not point to a test database');
  process.exit(1);
}

describe('Simulator REST API', () => {
  const app = buildApp();

  before(async () => {
    await app.ready();
    await prisma.lead.deleteMany({});
    await prisma.conversation.deleteMany({});
  });

  after(async () => {
    await app.close();
  });

  test('1. Valid message request & 2. New simulator user & 6. Database persistence', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/simulator/message',
      payload: { userId: 'sim_new', message: 'hi' } // hi triggers main menu due to invalid input handling
    });

    assert.strictEqual(response.statusCode, 200);
    const body = response.json();
    assert.strictEqual(body.userId, 'sim_new');
    assert.ok(body.response.includes('Invalid option'));
    assert.ok(body.response.includes('What type of IP protection'));

    const conv = await prisma.conversation.findUnique({
      where: { channel_externalUserId: { channel: 'simulator', externalUserId: 'sim_new' } }
    });
    assert.ok(conv);
    assert.strictEqual(conv.currentQuestionId, 'main_menu');
  });

  test('3. Existing simulator user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/simulator/message',
      payload: { userId: 'sim_new', message: '1' } // Patent
    });

    assert.strictEqual(response.statusCode, 200);
    const body = response.json();
    assert.ok(body.response.includes('What best describes your invention?'));
  });

  test('4. Two different simulator users remain isolated', async () => {
    // Send to a different user
    const response = await app.inject({
      method: 'POST',
      url: '/simulator/message',
      payload: { userId: 'sim_other', message: '2' } // Trademark
    });

    assert.strictEqual(response.statusCode, 200);
    const body = response.json();
    assert.ok(body.response.includes('What do you want to protect?')); // Not patent

    // Verify first user remains on patent
    const conv1 = await prisma.conversation.findUnique({
      where: { channel_externalUserId: { channel: 'simulator', externalUserId: 'sim_new' } }
    });
    assert.strictEqual(conv1!.currentQuestionId, 'patent_type');
  });

  test('5. Questionnaire response is returned & 7. Completed questionnaire creates Lead', async () => {
    // Complete sim_other's flow
    await app.inject({ method: 'POST', url: '/simulator/message', payload: { userId: 'sim_other', message: '1' } }); // what
    await app.inject({ method: 'POST', url: '/simulator/message', payload: { userId: 'sim_other', message: 'My brand desc' } }); // desc
    await app.inject({ method: 'POST', url: '/simulator/message', payload: { userId: 'sim_other', message: '1' } }); // usage
    await app.inject({ method: 'POST', url: '/simulator/message', payload: { userId: 'sim_other', message: '1' } }); // service
    await app.inject({ method: 'POST', url: '/simulator/message', payload: { userId: 'sim_other', message: 'Class 9' } }); // class
    
    // Shared fields
    await app.inject({ method: 'POST', url: '/simulator/message', payload: { userId: 'sim_other', message: 'Alice' } }); // name
    await app.inject({ method: 'POST', url: '/simulator/message', payload: { userId: 'sim_other', message: 'Wonderland Inc' } }); // org
    await app.inject({ method: 'POST', url: '/simulator/message', payload: { userId: 'sim_other', message: 'alice@example.com' } }); // email
    await app.inject({ method: 'POST', url: '/simulator/message', payload: { userId: 'sim_other', message: '111222' } }); // mobile
    await app.inject({ method: 'POST', url: '/simulator/message', payload: { userId: 'sim_other', message: 'London' } }); // city
    
    // Completion
    const response = await app.inject({
      method: 'POST',
      url: '/simulator/message',
      payload: { userId: 'sim_other', message: '3' } // Email comms
    });

    assert.strictEqual(response.statusCode, 200);
    assert.ok(response.json().response.includes('Thank you for sharing your requirement'));

    const conv = await prisma.conversation.findUnique({
      where: { channel_externalUserId: { channel: 'simulator', externalUserId: 'sim_other' } },
      include: { lead: true }
    });
    
    assert.strictEqual(conv!.isCompleted, true);
    assert.ok(conv!.lead);
    assert.strictEqual(conv!.lead.name, 'Alice');
  });

  test('8. Completed conversation restart behavior', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/simulator/message',
      payload: { userId: 'sim_other', message: '3' } // Start Design (restarts flow)
    });

    assert.strictEqual(response.statusCode, 200);
    const body = response.json();
    if (!body.response.includes('What type of product do you want to register?')) {
      console.error('Actual response:', body.response);
    }
    assert.ok(body.response.includes('What type of product do you want to register?')); // Re-entered flow
    
    const conv = await prisma.conversation.findUnique({
      where: { channel_externalUserId: { channel: 'simulator', externalUserId: 'sim_other' } }
    });
    assert.strictEqual(conv!.isCompleted, false);
    assert.strictEqual(conv!.currentQuestionId, 'design_product');
  });

  test('9. Missing userId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/simulator/message',
      payload: { message: 'hi' }
    });
    assert.strictEqual(response.statusCode, 400);
  });

  test('10. Missing/empty message', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/simulator/message',
      payload: { userId: 'u1' }
    });
    assert.strictEqual(response.statusCode, 400);

    const response2 = await app.inject({
      method: 'POST',
      url: '/simulator/message',
      payload: { userId: 'u1', message: '' }
    });
    assert.strictEqual(response2.statusCode, 400);
  });

  test('11. Malformed request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/simulator/message',
      payload: { userId: {}, message: 'hi' }
    });
    assert.strictEqual(response.statusCode, 400);
  });

  test('12. Internal error handling', async () => {
    // Temporarily mock service to throw
    const originalHandleMessage = require('../src/services/conversationService').conversationService.handleMessage;
    require('../src/services/conversationService').conversationService.handleMessage = async () => {
      throw new Error('Fake DB error');
    };

    const response = await app.inject({
      method: 'POST',
      url: '/simulator/message',
      payload: { userId: 'err', message: 'hi' }
    });
    
    assert.strictEqual(response.statusCode, 500);
    assert.strictEqual(response.json().error, 'Internal server error');
    assert.strictEqual(response.json().message, undefined); // Should not leak error details

    // Restore mock
    require('../src/services/conversationService').conversationService.handleMessage = originalHandleMessage;
  });

});

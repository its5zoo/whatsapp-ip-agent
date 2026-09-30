import { test } from 'node:test';
import * as assert from 'node:assert';
import { createWhatsAppProvider } from '../src/whatsapp/providers';

test.describe('WhatsApp provider boundary', () => {
  test('selects the Meta provider', () => {
    const provider = createWhatsAppProvider('meta');

    assert.strictEqual(provider.name, 'meta');
    assert.deepStrictEqual(provider.parseInbound(undefined), []);
  });

  test('selects the Evolution provider', () => {
    const provider = createWhatsAppProvider('evolution');

    assert.strictEqual(provider.name, 'evolution');
    assert.deepStrictEqual(provider.parseInbound({}), [
      { type: 'ignored', reason: 'unsupported Evolution event' }
    ]);
  });

  test('rejects invalid provider configuration', () => {
    assert.throws(
      () => createWhatsAppProvider('invalid'),
      /WHATSAPP_PROVIDER must be either "meta" or "evolution"/
    );
  });

  test('preserves normalized provider event types', () => {
    const provider = createWhatsAppProvider('meta');
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15550000000', phone_number_id: 'phone-id' },
            contacts: [{ profile: { name: 'Test User' }, wa_id: '15551112222' }],
            messages: [{
              from: '15551112222',
              id: 'wamid.test',
              timestamp: '123',
              type: 'text',
              text: { body: 'hello' }
            }]
          }
        }]
      }]
    };

    assert.deepStrictEqual(provider.parseInbound(payload), [{
      type: 'text',
      waId: '15551112222',
      messageId: 'wamid.test',
      text: 'hello'
    }]);
  });

  test('normalizes Evolution text messages and extracts the sender and text', () => {
    const provider = createWhatsAppProvider('evolution');

    assert.deepStrictEqual(provider.parseInbound({
      event: 'messages.upsert',
      data: {
        key: {
          remoteJid: '15551112222@s.whatsapp.net',
          id: 'evolution-message-1',
          fromMe: false
        },
        messageType: 'conversation',
        message: { conversation: 'hello from Evolution' }
      }
    }), [{
      type: 'text',
      waId: '15551112222@s.whatsapp.net',
      messageId: 'evolution-message-1',
      text: 'hello from Evolution'
    }]);
  });

  test('ignores Evolution fromMe and missing-ID events', () => {
    const provider = createWhatsAppProvider('evolution');

    assert.deepStrictEqual(provider.parseInbound({
      event: 'messages.upsert',
      data: {
        key: { remoteJid: '15551112222@s.whatsapp.net', id: 'reply-1', fromMe: true },
        messageType: 'conversation',
        message: { conversation: 'do not process' }
      }
    }), [{ type: 'ignored', reason: 'fromMe message' }]);

    assert.deepStrictEqual(provider.parseInbound({
      event: 'messages.upsert',
      data: {
        key: { remoteJid: '15551112222@s.whatsapp.net', id: '   ', fromMe: false },
        messageType: 'conversation',
        message: { conversation: 'missing id' }
      }
    }), [{ type: 'ignored', reason: 'missing sender or message ID' }]);
  });

  test('normalizes Evolution unsupported media', () => {
    const provider = createWhatsAppProvider('evolution');

    assert.deepStrictEqual(provider.parseInbound({
      event: 'messages.upsert',
      data: {
        key: {
          remoteJid: '15551112222@s.whatsapp.net',
          id: 'evolution-image-1',
          fromMe: false
        },
        messageType: 'imageMessage',
        message: { imageMessage: {} }
      }
    }), [{
      type: 'unsupported',
      waId: '15551112222@s.whatsapp.net',
      messageId: 'evolution-image-1',
      mediaType: 'imageMessage'
    }]);
  });
});

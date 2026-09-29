import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { parsePayload } from '../src/whatsapp/payloadParser';
import { WebhookPayload } from '../src/whatsapp/types';

describe('parsePayload', () => {
  test('should parse a text message', () => {
    const payload: WebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '1', phone_number_id: '2' },
            contacts: [{ profile: { name: 'Test' }, wa_id: '123456' }],
            messages: [{
              from: '123456',
              id: 'wamid.123',
              timestamp: '123',
              type: 'text',
              text: { body: 'hello' }
            }]
          }
        }]
      }]
    };

    const events = parsePayload(payload);
    assert.deepStrictEqual(events, [
      { type: 'text', waId: '123456', messageId: 'wamid.123', text: 'hello' }
    ]);
  });

  test('should parse an image message as unsupported', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '1', phone_number_id: '2' },
            contacts: [{ profile: { name: 'Test' }, wa_id: '123456' }],
            messages: [{
              from: '123456',
              id: 'wamid.456',
              timestamp: '123',
              type: 'image',
              image: { mime_type: 'image/jpeg', id: 'img1' }
            }]
          }
        }]
      }]
    } as unknown as WebhookPayload;

    const events = parsePayload(payload);
    assert.deepStrictEqual(events, [
      { type: 'unsupported', waId: '123456', messageId: 'wamid.456', mediaType: 'image' }
    ]);
  });

  test('should parse an audio message as unsupported', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '1', phone_number_id: '2' },
            contacts: [{ profile: { name: 'Test' }, wa_id: '123456' }],
            messages: [{
              from: '123456',
              id: 'wamid.789',
              timestamp: '123',
              type: 'audio'
            }]
          }
        }]
      }]
    } as unknown as WebhookPayload;

    const events = parsePayload(payload);
    assert.deepStrictEqual(events, [
      { type: 'unsupported', waId: '123456', messageId: 'wamid.789', mediaType: 'audio' }
    ]);
  });

  test('should parse a status event', () => {
    const payload: WebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '1', phone_number_id: '2' },
            statuses: [{
              id: 'wamid.status1',
              status: 'delivered',
              timestamp: '123',
              recipient_id: '123456'
            }]
          }
        }]
      }]
    };

    const events = parsePayload(payload);
    assert.deepStrictEqual(events, [
      { type: 'status', messageId: 'wamid.status1', status: 'delivered' }
    ]);
  });

  test('should parse a reaction event', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '1', phone_number_id: '2' },
            contacts: [{ profile: { name: 'Test' }, wa_id: '123456' }],
            messages: [{
              from: '123456',
              id: 'wamid.react1',
              timestamp: '123',
              type: 'reaction',
              reaction: { message_id: 'wamid.orig', emoji: '👍' }
            }]
          }
        }]
      }]
    } as unknown as WebhookPayload;

    const events = parsePayload(payload);
    assert.deepStrictEqual(events, [
      { type: 'reaction', messageId: 'wamid.react1' }
    ]);
  });

  test('should ignore entry with no messages and no statuses', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '1', phone_number_id: '2' }
          }
        }]
      }]
    } as unknown as WebhookPayload;

    const events = parsePayload(payload);
    assert.deepStrictEqual(events, [
      { type: 'ignored', reason: 'no messages or statuses found' }
    ]);
  });

  test('should handle empty entry array', () => {
    const payload: WebhookPayload = {
      object: 'whatsapp_business_account',
      entry: []
    };

    const events = parsePayload(payload);
    assert.deepStrictEqual(events, []);
  });

  test('should handle multiple entries and changes', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '1',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '1', phone_number_id: '2' },
              contacts: [{ profile: { name: 'Test1' }, wa_id: '11' }],
              messages: [{ from: '11', id: 'm1', timestamp: '1', type: 'text', text: { body: 't1' } }]
            }
          }]
        },
        {
          id: '2',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '1', phone_number_id: '2' },
              statuses: [{ id: 's1', status: 'read', timestamp: '1', recipient_id: '22' }]
            }
          }]
        }
      ]
    } as unknown as WebhookPayload;

    const events = parsePayload(payload);
    assert.deepStrictEqual(events, [
      { type: 'text', waId: '11', messageId: 'm1', text: 't1' },
      { type: 'status', messageId: 's1', status: 'read' }
    ]);
  });
});

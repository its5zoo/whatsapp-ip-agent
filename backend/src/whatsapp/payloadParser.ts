import { WebhookPayload, ParsedWebhookEvent } from './types';

export function parsePayload(payload: WebhookPayload): ParsedWebhookEvent[] {
  const events: ParsedWebhookEvent[] = [];

  if (!payload || payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
    return events;
  }

  for (const entry of payload.entry) {
    if (!Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      if (change.field !== 'messages' || !change.value) continue;

      const value = change.value;

      // Handle status updates
      if (Array.isArray(value.statuses) && value.statuses.length > 0) {
        for (const status of value.statuses) {
          events.push({
            type: 'status',
            messageId: status.id,
            status: status.status
          });
        }
        continue;
      }

      // Handle messages
      if (Array.isArray(value.messages) && value.messages.length > 0) {
        const contact = Array.isArray(value.contacts) && value.contacts.length > 0 ? value.contacts[0] : null;
        if (!contact || !contact.wa_id) {
          events.push({ type: 'ignored', reason: 'missing contact wa_id' });
          continue;
        }

        for (const message of value.messages) {
          const waId = contact.wa_id;
          const messageId = message.id;

          if (message.type === 'text') {
            if (message.text && message.text.body) {
              events.push({
                type: 'text',
                waId,
                messageId,
                text: message.text.body
              });
            } else {
              events.push({ type: 'ignored', reason: 'text message missing body' });
            }
          } else if (message.type === 'reaction') {
            events.push({
              type: 'reaction',
              messageId
            });
          } else {
            // Assume any other type (image, audio, interactive, etc.) is unsupported media
            events.push({
              type: 'unsupported',
              waId,
              messageId,
              mediaType: message.type
            });
          }
        }
        continue;
      }

      events.push({ type: 'ignored', reason: 'no messages or statuses found' });
    }
  }

  return events;
}

import { env, isWhatsappConfigured } from '../config/env';
import type { WhatsAppDeliveryResult } from '../whatsapp/providers/types';

export class WhatsappClient {
  public async sendTextMessage(toWaId: string, text: string): Promise<WhatsAppDeliveryResult> {
    if (!isWhatsappConfigured()) {
      return { outcome: 'failed', retryable: false, error: 'Meta provider is not configured' };
    }

    const url = `https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    const body = {
      messaging_product: 'whatsapp',
      to: toWaId,
      type: 'text',
      text: {
        body: text
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        // Do not log the body or full error to avoid credential leakage
        console.error(`WhatsappClient: Meta Graph API error, status: ${response.status}`);
        return {
          outcome: 'failed',
          retryable: response.status === 429 || response.status >= 500,
          error: `Meta API returned ${response.status}`
        };
      }
      return { outcome: 'accepted' };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('WhatsappClient: Request to Meta Graph API timed out');
          return { outcome: 'unknown', error: 'Meta request timed out' };
        } else {
          console.error(`WhatsappClient: Error sending message: ${error.message}`);
          return { outcome: 'unknown', error: 'Meta request failed' };
        }
      } else {
        console.error('WhatsappClient: Unknown error sending message');
        return { outcome: 'unknown', error: 'Meta request failed' };
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const whatsappClient = new WhatsappClient();

import { env } from '../../config/env';
import type { NormalizedProviderEvent, WhatsAppProvider, WhatsAppDeliveryResult } from './types';

/** Evolution inbound and outbound WhatsApp adapter. */
export class EvolutionWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'evolution' as const;

  verifyWebhookSecret(secret: string | undefined): boolean {
    return !!env.EVOLUTION_WEBHOOK_SECRET &&
      !!secret &&
      secret === env.EVOLUTION_WEBHOOK_SECRET;
  }

  verifyInboundChallenge(): boolean {
    return false;
  }

  verifyInboundSignature(): boolean {
    return false;
  }

  parseInbound(payload: unknown): NormalizedProviderEvent[] {
    if (!payload || typeof payload !== 'object') {
      return [{ type: 'ignored', reason: 'invalid Evolution webhook payload' }];
    }

    const body = payload as {
      event?: string;
      data?: {
        key?: {
          remoteJid?: string;
          id?: string;
          fromMe?: boolean;
        };
        message?: {
          conversation?: string;
        };
        messageType?: string;
      };
    };

    if (body.event !== 'messages.upsert' || !body.data || body.data.key?.fromMe === true) {
      return [{ type: 'ignored', reason: body.data?.key?.fromMe === true ? 'fromMe message' : 'unsupported Evolution event' }];
    }

    const remoteJid = body.data.key?.remoteJid;
    const messageId = body.data.key?.id;
    if (!remoteJid || !messageId?.trim()) {
      return [{ type: 'ignored', reason: 'missing sender or message ID' }];
    }

    if (body.data.messageType === 'conversation' && body.data.message?.conversation) {
      return [{
        type: 'text',
        waId: remoteJid,
        messageId,
        text: body.data.message.conversation
      }];
    }

    return [{
      type: 'unsupported',
      waId: remoteJid,
      messageId,
      mediaType: body.data.messageType || 'unknown'
    }];
  }

  async sendTextMessage(toWaId: string, text: string): Promise<WhatsAppDeliveryResult> {
    if (!env.EVOLUTION_API_URL || !env.EVOLUTION_API_KEY || !env.EVOLUTION_INSTANCE) {
      return { outcome: 'failed', retryable: false, error: 'Evolution provider is not configured' };
    }

    const url = `${env.EVOLUTION_API_URL.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(env.EVOLUTION_INSTANCE)}`;
    const body = {
      number: normalizeEvolutionRecipient(toWaId),
      text,
      delay: 0,
      linkPreview: false
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: env.EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        console.error(`EvolutionWhatsAppProvider: API error, status: ${response.status}`);
        return {
          outcome: 'failed',
          retryable: response.status === 429 || response.status >= 500,
          error: `Evolution API returned ${response.status}`
        };
      }
      return { outcome: 'accepted' };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('EvolutionWhatsAppProvider: Request timed out');
        return { outcome: 'unknown', error: 'Evolution request timed out' };
      } else {
        console.error('EvolutionWhatsAppProvider: Error sending message');
        return { outcome: 'unknown', error: 'Evolution request failed' };
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function normalizeEvolutionRecipient(recipient: string): string {
  const number = recipient.split('@', 1)[0];
  return number.startsWith('+') ? number.slice(1) : number;
}

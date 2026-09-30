import { env } from '../../config/env';
import { whatsappClient } from '../../services/whatsappClient';
import { parsePayload } from '../payloadParser';
import { verifySignature } from '../signatureVerifier';
import type { WebhookPayload } from '../types';
import type { NormalizedProviderEvent, WhatsAppProvider } from './types';

export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'meta' as const;

  verifyInboundChallenge(mode: string | undefined, verifyToken: string | undefined): boolean {
    return mode === 'subscribe' && verifyToken === env.WHATSAPP_VERIFY_TOKEN;
  }

  verifyInboundSignature(rawBody: Buffer, signature: string | undefined): boolean {
    return !!env.META_APP_SECRET && verifySignature(rawBody, signature, env.META_APP_SECRET);
  }

  verifyWebhookSecret(): boolean {
    return false;
  }

  parseInbound(payload: unknown): NormalizedProviderEvent[] {
    return parsePayload(payload as WebhookPayload);
  }

  sendTextMessage(toWaId: string, text: string): Promise<void> {
    return whatsappClient.sendTextMessage(toWaId, text);
  }
}

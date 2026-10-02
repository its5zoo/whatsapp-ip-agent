import type { WhatsappProvider as WhatsappProviderName } from '../../config/env';

export type NormalizedProviderEvent =
  | { type: 'text'; waId: string; messageId: string; text: string }
  | { type: 'unsupported'; waId: string; messageId: string; mediaType: string }
  | { type: 'status'; messageId: string; status: string }
  | { type: 'reaction'; messageId: string }
  | { type: 'ignored'; reason: string };

export type WhatsAppDeliveryResult =
  | { outcome: 'accepted' }
  | { outcome: 'failed'; retryable: boolean; error?: string }
  | { outcome: 'unknown'; error?: string };

export interface WhatsAppProvider {
  readonly name: WhatsappProviderName;
  verifyInboundChallenge(mode: string | undefined, verifyToken: string | undefined): boolean;
  verifyInboundSignature(rawBody: Buffer, signature: string | undefined): boolean;
  verifyWebhookSecret(secret: string | undefined): boolean;
  parseInbound(payload: unknown): NormalizedProviderEvent[];
  sendTextMessage(toWaId: string, text: string): Promise<WhatsAppDeliveryResult>;
}

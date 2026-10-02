import { whatsappOutboundMessageRepository } from '../db/repositories/whatsappOutboundMessageRepository';
import type { WhatsAppProvider } from '../whatsapp/providers/types';

const DISPATCH_INTERVAL_MS = 5_000;
const MAX_CONCURRENT_DISPATCHES = 4;
const SHUTDOWN_WAIT_MS = 11_000;

export class WhatsappDeliveryService {
  private timer: NodeJS.Timeout | undefined;
  private provider: WhatsAppProvider | undefined;
  private stopping = false;
  private activeDispatches = new Set<Promise<void>>();

  start(provider: WhatsAppProvider): void {
    this.provider = provider;
    this.stopping = false;
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.dispatchAvailable();
    }, DISPATCH_INTERVAL_MS);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    const activeDispatches = [...this.activeDispatches];
    if (activeDispatches.length > 0) {
      await Promise.race([
        Promise.allSettled(activeDispatches),
        new Promise<void>(resolve => setTimeout(resolve, SHUTDOWN_WAIT_MS))
      ]);
    }
    this.provider = undefined;
  }

  async deliverByInboundMessageId(
    inboundMessageId: string,
    provider?: WhatsAppProvider
  ): Promise<void> {
    await this.dispatchOne(inboundMessageId, provider);
  }

  private dispatchAvailable(): void {
    if (this.stopping || !this.provider) return;

    const availableSlots = MAX_CONCURRENT_DISPATCHES - this.activeDispatches.size;
    for (let index = 0; index < availableSlots; index += 1) {
      this.dispatchOne().catch(() => {
        console.error('WhatsApp delivery dispatcher failed');
      });
    }
  }

  private async dispatchOne(
    inboundMessageId?: string,
    provider?: WhatsAppProvider
  ): Promise<void> {
    const providerToUse = provider || this.provider;
    if (!providerToUse || this.stopping || this.activeDispatches.size >= MAX_CONCURRENT_DISPATCHES) return;

    const dispatch = this.performDispatch(inboundMessageId, providerToUse);
    this.activeDispatches.add(dispatch);
    void dispatch.then(
      () => this.activeDispatches.delete(dispatch),
      () => this.activeDispatches.delete(dispatch)
    );
    await dispatch;
  }

  private async performDispatch(
    inboundMessageId: string | undefined,
    provider: WhatsAppProvider
  ): Promise<void> {
    const message = await whatsappOutboundMessageRepository.claim(inboundMessageId);
    if (!message) return;

    const result = await provider.sendTextMessage(message.waId, message.text);
    if (result.outcome === 'accepted') {
      await whatsappOutboundMessageRepository.markSent(message.id);
    } else if (result.outcome === 'failed' && !result.retryable) {
      await whatsappOutboundMessageRepository.markFailed(
        message.id,
        result.error || 'WhatsApp delivery rejected'
      );
    } else {
      await whatsappOutboundMessageRepository.markRetryable(
        message.id,
        result.error || 'WhatsApp delivery outcome was unknown',
        message.attempts
      );
    }
  }
}

export const whatsappDeliveryService = new WhatsappDeliveryService();

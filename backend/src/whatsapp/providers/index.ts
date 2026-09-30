import { env, parseWhatsappProvider } from '../../config/env';
import { EvolutionWhatsAppProvider } from './evolution';
import { MetaWhatsAppProvider } from './meta';
import type { WhatsAppProvider } from './types';

export function createWhatsAppProvider(
  providerName = env.WHATSAPP_PROVIDER
): WhatsAppProvider {
  switch (parseWhatsappProvider(providerName)) {
    case 'meta':
      return new MetaWhatsAppProvider();
    case 'evolution':
      return new EvolutionWhatsAppProvider();
  }
}

export type { NormalizedProviderEvent, WhatsAppProvider } from './types';

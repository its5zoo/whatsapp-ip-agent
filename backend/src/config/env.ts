import dotenv from 'dotenv';

dotenv.config();

export type WhatsappProvider = 'meta' | 'evolution';

export function parseWhatsappProvider(value: string | undefined): WhatsappProvider {
  const provider = value || 'meta';
  if (provider !== 'meta' && provider !== 'evolution') {
    throw new Error('WHATSAPP_PROVIDER must be either "meta" or "evolution"');
  }
  return provider;
}

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  DATABASE_URL: process.env.DATABASE_URL as string,
  AI_PROVIDER: process.env.AI_PROVIDER || 'gemini',
  AI_API_KEY: process.env.AI_API_KEY,
  AI_MODEL: process.env.AI_MODEL,
  AI_CONFIDENCE_THRESHOLD: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.80'),
  AI_TIMEOUT_MS: parseInt(process.env.AI_TIMEOUT_MS || '5000', 10),
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
  N8N_WEBHOOK_SECRET: process.env.N8N_WEBHOOK_SECRET,
  N8N_TIMEOUT_MS: parseInt(process.env.N8N_TIMEOUT_MS || '5000', 10),

  // Phase 7: Admin Dashboard
  ADMIN_USERNAME: process.env.ADMIN_USERNAME as string,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3001',

  // Phase 9: WhatsApp Integration (Optional)
  WHATSAPP_PROVIDER: parseWhatsappProvider(process.env.WHATSAPP_PROVIDER),
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
  META_APP_SECRET: process.env.META_APP_SECRET,
  WHATSAPP_GRAPH_API_VERSION: process.env.WHATSAPP_GRAPH_API_VERSION || 'v22.0',
  WHATSAPP_REPLY_UNSUPPORTED: process.env.WHATSAPP_REPLY_UNSUPPORTED || 'Thank you for your message! This service only accepts text replies.\nPlease type your response to continue.',
  EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
  EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
  EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE,
  EVOLUTION_WEBHOOK_SECRET: process.env.EVOLUTION_WEBHOOK_SECRET,
};

export function isWhatsappProviderConfigured(provider: WhatsappProvider): boolean {
  if (provider === 'meta') {
    return !!(
      env.WHATSAPP_PHONE_NUMBER_ID &&
      env.WHATSAPP_ACCESS_TOKEN &&
      env.WHATSAPP_VERIFY_TOKEN &&
      env.META_APP_SECRET
    );
  }

  return !!(
    env.EVOLUTION_API_URL &&
    env.EVOLUTION_API_KEY &&
    env.EVOLUTION_INSTANCE &&
    env.EVOLUTION_WEBHOOK_SECRET
  );
}

// Phase 9 helper for checking if the active WhatsApp provider is configured
export const isWhatsappConfigured = () => isWhatsappProviderConfigured(env.WHATSAPP_PROVIDER);

// Validate required admin variables
if (!env.ADMIN_USERNAME) throw new Error('ADMIN_USERNAME is required');
if (!env.ADMIN_PASSWORD_HASH) throw new Error('ADMIN_PASSWORD_HASH is required');
if (!env.JWT_SECRET) throw new Error('JWT_SECRET is required');

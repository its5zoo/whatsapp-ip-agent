import { test } from 'node:test';
import * as assert from 'node:assert';
import {
  env,
  isWhatsappConfigured,
  parseWhatsappProvider,
  validateProductionWhatsappConfig
} from '../src/config/env';

test.describe('WhatsApp configuration', () => {
  const original = {
    provider: env.WHATSAPP_PROVIDER,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    verifyToken: env.WHATSAPP_VERIFY_TOKEN,
    appSecret: env.META_APP_SECRET,
    evolutionUrl: env.EVOLUTION_API_URL,
    evolutionKey: env.EVOLUTION_API_KEY,
    evolutionInstance: env.EVOLUTION_INSTANCE,
    evolutionSecret: env.EVOLUTION_WEBHOOK_SECRET
  };
  const originalNodeEnv = process.env.NODE_ENV;

  test.afterEach(() => {
    env.WHATSAPP_PROVIDER = original.provider;
    env.WHATSAPP_PHONE_NUMBER_ID = original.phoneNumberId;
    env.WHATSAPP_ACCESS_TOKEN = original.accessToken;
    env.WHATSAPP_VERIFY_TOKEN = original.verifyToken;
    env.META_APP_SECRET = original.appSecret;
    env.EVOLUTION_API_URL = original.evolutionUrl;
    env.EVOLUTION_API_KEY = original.evolutionKey;
    env.EVOLUTION_INSTANCE = original.evolutionInstance;
    env.EVOLUTION_WEBHOOK_SECRET = original.evolutionSecret;
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  test('defaults an unset provider to Meta', () => {
    assert.strictEqual(parseWhatsappProvider(undefined), 'meta');
  });

  test('accepts explicit Meta provider', () => {
    assert.strictEqual(parseWhatsappProvider('meta'), 'meta');
  });

  test('accepts explicit Evolution provider', () => {
    assert.strictEqual(parseWhatsappProvider('evolution'), 'evolution');
  });

  test('rejects invalid provider values', () => {
    assert.throws(
      () => parseWhatsappProvider('invalid'),
      /WHATSAPP_PROVIDER must be either "meta" or "evolution"/
    );
  });

  test('requires only Meta credentials in Meta mode', () => {
    env.WHATSAPP_PROVIDER = 'meta';
    env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id';
    env.WHATSAPP_ACCESS_TOKEN = 'access-token';
    env.WHATSAPP_VERIFY_TOKEN = 'verify-token';
    env.META_APP_SECRET = 'app-secret';
    env.EVOLUTION_API_URL = undefined;
    env.EVOLUTION_API_KEY = undefined;
    env.EVOLUTION_INSTANCE = undefined;
    env.EVOLUTION_WEBHOOK_SECRET = undefined;

    assert.strictEqual(isWhatsappConfigured(), true);
  });

  test('requires only Evolution credentials in Evolution mode', () => {
    env.WHATSAPP_PROVIDER = 'evolution';
    env.WHATSAPP_PHONE_NUMBER_ID = undefined;
    env.WHATSAPP_ACCESS_TOKEN = undefined;
    env.WHATSAPP_VERIFY_TOKEN = undefined;
    env.META_APP_SECRET = undefined;
    env.EVOLUTION_API_URL = 'https://evolution.example.com';
    env.EVOLUTION_API_KEY = 'evolution-key';
    env.EVOLUTION_INSTANCE = 'instance';
    env.EVOLUTION_WEBHOOK_SECRET = 'webhook-secret';

    assert.strictEqual(isWhatsappConfigured(), true);
  });

  test('reports incomplete provider credentials as not configured', () => {
    env.WHATSAPP_PROVIDER = 'evolution';
    env.EVOLUTION_API_URL = 'https://evolution.example.com';
    env.EVOLUTION_API_KEY = undefined;
    env.EVOLUTION_INSTANCE = 'instance';
    env.EVOLUTION_WEBHOOK_SECRET = 'webhook-secret';

    assert.strictEqual(isWhatsappConfigured(), false);
  });

  test('keeps Meta configuration valid without Evolution credentials in production', () => {
    process.env.NODE_ENV = 'production';
    env.WHATSAPP_PROVIDER = 'meta';
    env.EVOLUTION_API_KEY = undefined;
    env.EVOLUTION_INSTANCE = undefined;

    assert.doesNotThrow(() => validateProductionWhatsappConfig());
  });

  test('fails production Evolution configuration when the API key is missing', () => {
    process.env.NODE_ENV = 'production';
    env.WHATSAPP_PROVIDER = 'evolution';
    env.EVOLUTION_API_KEY = '';
    env.EVOLUTION_INSTANCE = 'instance';

    assert.throws(
      () => validateProductionWhatsappConfig(),
      /EVOLUTION_API_KEY is required/
    );
  });

  test('fails production Evolution configuration when the instance is missing', () => {
    process.env.NODE_ENV = 'production';
    env.WHATSAPP_PROVIDER = 'evolution';
    env.EVOLUTION_API_KEY = 'evolution-key';
    env.EVOLUTION_INSTANCE = ' ';

    assert.throws(
      () => validateProductionWhatsappConfig(),
      /EVOLUTION_INSTANCE is required/
    );
  });

  test('accepts valid production Evolution configuration', () => {
    process.env.NODE_ENV = 'production';
    env.WHATSAPP_PROVIDER = 'evolution';
    env.EVOLUTION_API_KEY = 'evolution-key';
    env.EVOLUTION_INSTANCE = 'instance';

    assert.doesNotThrow(() => validateProductionWhatsappConfig());
  });
});

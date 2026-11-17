import 'reflect-metadata';
import { assertBaleRuntimeConfig, validateEnv } from './env.validation';

const base = {
  NODE_ENV: 'test',
  PORT: 3000,
  DATABASE_URL: 'postgresql://khaan:khaan@localhost:5432/khaan',
  FRONTEND_ORIGIN: 'http://localhost:5173',
};

describe('assertBaleRuntimeConfig', () => {
  it('allows the Mini App to stay off with empty secrets', () => {
    expect(() =>
      assertBaleRuntimeConfig({
        BALE_MINI_APP_ENABLED: false,
        BALE_BOT_TOKEN: '',
        BALE_WEBHOOK_SECRET: '',
      }),
    ).not.toThrow();
  });

  it('rejects an enabled Mini App without a bot token', () => {
    expect(() =>
      assertBaleRuntimeConfig({
        BALE_MINI_APP_ENABLED: true,
        BALE_BOT_TOKEN: '',
        BALE_WEBHOOK_SECRET: 'webhook-secret-value',
      }),
    ).toThrow(/BALE_BOT_TOKEN/);
  });

  it('rejects an enabled Mini App without a webhook secret', () => {
    expect(() =>
      assertBaleRuntimeConfig({
        BALE_MINI_APP_ENABLED: true,
        BALE_BOT_TOKEN: '100:test-token',
        BALE_WEBHOOK_SECRET: '',
      }),
    ).toThrow(/BALE_WEBHOOK_SECRET/);
  });

  it('accepts an enabled Mini App with token and secret', () => {
    expect(() =>
      assertBaleRuntimeConfig({
        BALE_MINI_APP_ENABLED: true,
        BALE_BOT_TOKEN: '100:test-token',
        BALE_WEBHOOK_SECRET: 'webhook-secret-value',
      }),
    ).not.toThrow();
  });
});

describe('validateEnv', () => {
  it('keeps Bale disabled by default in test', () => {
    const env = validateEnv(base);
    expect(env.BALE_MINI_APP_ENABLED).toBe(false);
  });

  it('fails production-like enablement when the webhook secret is missing', () => {
    expect(() =>
      validateEnv({
        ...base,
        BALE_MINI_APP_ENABLED: 'true',
        BALE_BOT_TOKEN: '100:test-token',
        BALE_WEBHOOK_SECRET: '',
      }),
    ).toThrow(/BALE_WEBHOOK_SECRET/);
  });
});

import {
  readBaleWebhookSecretHeader,
  webhookSecretsMatch,
} from './webhook-secret';

describe('webhookSecretsMatch', () => {
  const secret = 'webhook-secret-value';

  it('rejects an empty expected secret', () => {
    expect(webhookSecretsMatch(secret, '')).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(webhookSecretsMatch(undefined, secret)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    expect(webhookSecretsMatch('other-secret-value', secret)).toBe(false);
  });

  it('accepts the matching header value', () => {
    expect(webhookSecretsMatch(secret, secret)).toBe(true);
  });

  it('reads the official Telegram/Bale secret header and ignores query-like fields', () => {
    expect(
      readBaleWebhookSecretHeader({
        'x-telegram-bot-api-secret-token': secret,
        secret,
      }),
    ).toBe(secret);
    expect(readBaleWebhookSecretHeader({ secret })).toBeUndefined();
  });
});

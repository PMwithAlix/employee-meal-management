import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  BALE_WEBHOOK_PATH_TOKEN_LENGTH,
  baleWebhookDeliveryUrl,
  baleWebhookPathToken,
  isBaleWebhookPath,
  redactKnownWebhookSecrets,
  redactWebhookPath,
  webhookPathTokenMatches,
  webhookSecretsMatch,
} from './webhook-secret';

describe('webhook path secret', () => {
  const secret = 'webhook-secret-value';
  const token = baleWebhookPathToken(secret);

  it('rejects an empty expected secret', () => {
    expect(webhookSecretsMatch(secret, '')).toBe(false);
    expect(webhookPathTokenMatches(token, '')).toBe(false);
  });

  it('rejects a missing or wrong path token', () => {
    expect(webhookPathTokenMatches(undefined, secret)).toBe(false);
    expect(webhookPathTokenMatches('other-secret-value', secret)).toBe(false);
    expect(webhookPathTokenMatches(secret, secret)).toBe(false);
  });

  it('accepts only the derived path token', () => {
    expect(token).toHaveLength(BALE_WEBHOOK_PATH_TOKEN_LENGTH);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(webhookPathTokenMatches(token, secret)).toBe(true);
    expect(isBaleWebhookPath(`/api/v1/bale/webhook/${token}`)).toBe(true);
    expect(isBaleWebhookPath('/api/v1/bale/webhook')).toBe(false);
    expect(isBaleWebhookPath('/api/v1/bale/webhook/sync')).toBe(false);
    expect(isBaleWebhookPath('/api/v1/bale/webhook/info')).toBe(false);
  });

  it('appends the path token to the public webhook url once', () => {
    const base = 'https://food.kavosh.site/api/v1/bale/webhook';
    const delivery = `${base}/${token}`;
    expect(baleWebhookDeliveryUrl(`${base}/`, secret)).toBe(delivery);
    expect(baleWebhookDeliveryUrl(`${base}?discarded=1`, secret)).toBe(delivery);
    expect(baleWebhookDeliveryUrl(delivery, secret)).toBe(delivery);
    expect(baleWebhookDeliveryUrl('not a url', secret)).toBe('');
    expect(delivery).not.toContain('secret_token');
  });

  it('removes the secret path from text that would be logged or returned', () => {
    const url = `https://food.kavosh.site/api/v1/bale/webhook/${token}?echo=${secret}`;
    const redacted = redactKnownWebhookSecrets(`failed ${url} ${secret}`, secret);
    expect(redacted).not.toContain(token);
    expect(redacted).not.toContain(secret);
    expect(redacted).toContain('/api/v1/bale/webhook/[redacted]');
    expect(redactWebhookPath(`/api/v1/bale/webhook/${token}`)).toBe(
      '/api/v1/bale/webhook/[redacted]',
    );
  });

  it('keeps the nginx access log from recording the webhook secret', () => {
    const nginx = readFileSync(resolve(__dirname, '../../../../frontend/nginx.conf'), 'utf8');
    const format = nginx.match(/log_format khaan [^;]+;/)?.[0] ?? '';
    expect(format).toContain('$khaan_log_uri');
    expect(format).not.toContain('$request_uri');
    expect(format).not.toContain('$uri');
    expect(format).not.toMatch(/\$request[^_]/);
    expect(nginx).toContain('~^/api/v1/bale/webhook/.+  /api/v1/bale/webhook/[redacted]');
    expect(nginx).toContain(
      `location ~ '^/api/v1/bale/webhook/[A-Za-z0-9_-]{${BALE_WEBHOOK_PATH_TOKEN_LENGTH}}$'`,
    );
    expect(nginx).not.toContain(
      `location ~ ^/api/v1/bale/webhook/[A-Za-z0-9_-]{${BALE_WEBHOOK_PATH_TOKEN_LENGTH}}$`,
    );
    expect(nginx).toContain('error_log /dev/null emerg;');
    expect(nginx).not.toContain(secret);
    expect(nginx).not.toContain(token);
  });
});

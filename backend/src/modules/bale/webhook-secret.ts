import { createHash, timingSafeEqual } from 'crypto';

/** SHA-256 base64url digest length. Nginx redaction must use this same length. */
export const BALE_WEBHOOK_PATH_TOKEN_LENGTH = 43;

export function baleWebhookPathToken(secret: string) {
  const trimmed = secret.trim();
  if (!trimmed) {
    return '';
  }
  return createHash('sha256').update(trimmed, 'utf8').digest('base64url');
}

export function isBaleWebhookPath(path: string) {
  const pathname = path.split('?')[0];
  return new RegExp(
    `^/api/v1/bale/webhook/[A-Za-z0-9_-]{${BALE_WEBHOOK_PATH_TOKEN_LENGTH}}$`,
  ).test(pathname);
}

export function baleWebhookDeliveryUrl(configuredUrl: string, secret: string) {
  const token = baleWebhookPathToken(secret);
  if (!token) {
    return '';
  }
  let url: URL;
  try {
    url = new URL(configuredUrl.trim());
  } catch {
    return '';
  }
  const cleanPath = url.pathname.replace(/\/+$/, '');
  const suffix = `/${token}`;
  url.pathname = cleanPath.endsWith(suffix) ? cleanPath : `${cleanPath}${suffix}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function webhookSecretsMatch(
  provided: string | undefined,
  expected: string,
) {
  const wanted = expected.trim();
  if (!wanted) {
    return false;
  }
  const given = Buffer.from(provided ?? '', 'utf8');
  const need = Buffer.from(wanted, 'utf8');
  if (given.length !== need.length) {
    timingSafeEqual(need, need);
    return false;
  }
  return timingSafeEqual(given, need);
}

export function webhookPathTokenMatches(
  provided: string | undefined,
  secret: string,
) {
  const expected = baleWebhookPathToken(secret);
  if (!expected) {
    return false;
  }
  return webhookSecretsMatch(provided, expected);
}

export function redactWebhookPath(value: string) {
  return value.replace(
    new RegExp(
      `/api/v1/bale/webhook/[A-Za-z0-9_-]{${BALE_WEBHOOK_PATH_TOKEN_LENGTH}}(?:\\?[^\\s#]*)?`,
      'g',
    ),
    '/api/v1/bale/webhook/[redacted]',
  );
}

export function redactWebhookPaths<T>(value: T): T {
  if (typeof value === 'string') {
    return redactWebhookPath(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactWebhookPaths(item)) as T;
  }
  if (value && typeof value === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      redacted[key] = redactWebhookPaths(item);
    }
    return redacted as T;
  }
  return value;
}

export function redactKnownWebhookSecrets(value: string, secret: string) {
  let next = redactWebhookPath(value);
  const trimmed = secret.trim();
  const needles = [
    trimmed.length >= 16 ? trimmed : '',
    baleWebhookPathToken(trimmed),
  ].filter((item) => item.length > 0);
  for (const needle of needles) {
    next = next.split(needle).join('[redacted]');
  }
  return next;
}

export function redactKnownWebhookSecretsDeep<T>(value: T, secret: string): T {
  if (typeof value === 'string') {
    return redactKnownWebhookSecrets(value, secret) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactKnownWebhookSecretsDeep(item, secret)) as T;
  }
  if (value && typeof value === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      redacted[key] = redactKnownWebhookSecretsDeep(item, secret);
    }
    return redacted as T;
  }
  return value;
}

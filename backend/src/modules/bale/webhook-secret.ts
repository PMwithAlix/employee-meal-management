import { timingSafeEqual } from 'crypto';

export const BALE_WEBHOOK_SECRET_HEADER = 'x-telegram-bot-api-secret-token';
export const BALE_WEBHOOK_SECRET_HEADER_ALT = 'x-bale-bot-api-secret-token';

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
) {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function readBaleWebhookSecretHeader(
  headers: Record<string, string | string[] | undefined>,
) {
  return (
    headerValue(headers, BALE_WEBHOOK_SECRET_HEADER) ??
    headerValue(headers, BALE_WEBHOOK_SECRET_HEADER_ALT)
  );
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

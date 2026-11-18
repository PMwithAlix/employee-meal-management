import { createHmac, timingSafeEqual } from 'crypto';

export type BaleWebAppUser = {
  id: number;
  first_name?: string;
  username?: string;
  allows_write_to_pm?: boolean;
};

export type VerifiedBaleInitData = {
  user: BaleWebAppUser;
  authDate: number;
  queryId: string | null;
};

export type InitDataFailureCode =
  | 'empty'
  | 'missing_hash'
  | 'invalid_signature'
  | 'invalid_auth_date'
  | 'expired'
  | 'missing_user'
  | 'invalid_user_json'
  | 'invalid_user_id'
  | 'missing_bot_token';

export class InitDataError extends Error {
  constructor(
    message: string,
    readonly code: InitDataFailureCode,
  ) {
    super(message);
    this.name = 'InitDataError';
  }
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function parseUser(raw: string | null): BaleWebAppUser {
  if (!raw) {
    throw new InitDataError('دادهٔ کاربر بله در initData موجود نیست.', 'missing_user');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InitDataError('دادهٔ کاربر بله نامعتبر است.', 'invalid_user_json');
  }
  const body = asRecord(parsed);
  if (!body || typeof body.id !== 'number' || !Number.isInteger(body.id)) {
    throw new InitDataError('شناسهٔ کاربر بله نامعتبر است.', 'invalid_user_id');
  }
  return {
    id: body.id,
    first_name: typeof body.first_name === 'string' ? body.first_name : undefined,
    username: typeof body.username === 'string' ? body.username : undefined,
    allows_write_to_pm:
      typeof body.allows_write_to_pm === 'boolean'
        ? body.allows_write_to_pm
        : undefined,
  };
}

function hmacSha256(key: string | Buffer, data: string) {
  return createHmac('sha256', key).update(data);
}

function hexEquals(left: string, right: string) {
  const a = Buffer.from(left.toLowerCase(), 'utf8');
  const b = Buffer.from(right.toLowerCase(), 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function buildDataCheckString(pairs: Array<[string, string]>) {
  return pairs
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

export function computeInitDataHash(botToken: string, dataCheckString: string) {
  // Bale copies Telegram's Mini App scheme. PHP hash_hmac($data, $key) and
  // Python hmac.new(key=b"WebAppData", msg=bot_token) both use WebAppData as the
  // HMAC key. Nightly Bale docs write HMAC_SHA256(<bot_token>, "WebAppData"),
  // which Node createHmac treats as the opposite argument order.
  const secretKey = hmacSha256('WebAppData', botToken).digest();
  return hmacSha256(secretKey, dataCheckString).digest('hex');
}

export function verifyBaleInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = 86400,
): VerifiedBaleInitData {
  if (!botToken) {
    throw new InitDataError('توکن بازوی بله پیکربندی نشده است.', 'missing_bot_token');
  }
  const trimmed = initData.trim();
  if (!trimmed) {
    throw new InitDataError('initData خالی است.', 'empty');
  }

  const params = new URLSearchParams(trimmed);
  const hash = params.get('hash');
  if (!hash) {
    throw new InitDataError('امضای initData موجود نیست.', 'missing_hash');
  }

  const pairs: Array<[string, string]> = [];
  for (const [key, value] of params.entries()) {
    pairs.push([key, value]);
  }

  const dataCheckString = buildDataCheckString(pairs);
  const expected = computeInitDataHash(botToken, dataCheckString);
  if (!hexEquals(expected, hash)) {
    throw new InitDataError('امضای دادهٔ بله معتبر نیست.', 'invalid_signature');
  }

  const authDateRaw = params.get('auth_date');
  const authDate = authDateRaw ? Number(authDateRaw) : NaN;
  if (!Number.isInteger(authDate) || authDate <= 0) {
    throw new InitDataError('زمان اعتبارسنجی بله نامعتبر است.', 'invalid_auth_date');
  }
  if (Math.abs(nowSeconds - authDate) > ttlSeconds) {
    throw new InitDataError(
      'نشست مینی‌اپ منقضی شده است. مینی‌اپ را ببندید و دوباره باز کنید.',
      'expired',
    );
  }

  return {
    user: parseUser(params.get('user')),
    authDate,
    queryId: params.get('query_id'),
  };
}

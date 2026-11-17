import { createHmac } from 'crypto';
import {
  buildDataCheckString,
  computeInitDataHash,
  verifyBaleInitData,
} from './init-data';

function signedInitData(token: string, fields: Record<string, string>) {
  const pairs = Object.entries(fields);
  const dataCheckString = buildDataCheckString([...pairs, ['hash', 'ignored']]);
  const hash = computeInitDataHash(token, dataCheckString);
  const params = new URLSearchParams({ ...fields, hash });
  return params.toString();
}

describe('verifyBaleInitData', () => {
  const token = '100:test-token-not-for-production';
  const user = JSON.stringify({ id: 42, first_name: 'Ali', username: 'ali' });

  it('accepts HMAC-SHA256 signed initData using the official Bale WebAppData key', () => {
    const initData = signedInitData(token, {
      auth_date: '1700000000',
      query_id: 'AAE',
      user,
    });
    const verified = verifyBaleInitData(initData, token, 1700000000, 60);
    expect(verified.user.id).toBe(42);
    expect(verified.user.username).toBe('ali');
    expect(verified.queryId).toBe('AAE');
  });

  it('rejects a tampered hash', () => {
    const initData = signedInitData(token, {
      auth_date: '1700000000',
      user,
    }).replace(/hash=[^&]+/, 'hash=deadbeef');
    expect(() => verifyBaleInitData(initData, token, 1700000000, 60)).toThrow(
      'امضای دادهٔ بله معتبر نیست.',
    );
  });

  it('rejects stale auth_date', () => {
    const initData = signedInitData(token, {
      auth_date: '1000',
      user,
    });
    expect(() => verifyBaleInitData(initData, token, 1700000000, 60)).toThrow(
      'نشست مینی‌اپ منقضی شده است',
    );
  });

  it('uses HMAC(bot_token, "WebAppData") as documented by Bale, not Telegram\'s reversed key', () => {
    const dataCheckString = 'auth_date=1\nuser={"id":1}';
    const baleSecret = createHmac('sha256', token).update('WebAppData').digest();
    const telegramSecret = createHmac('sha256', 'WebAppData').update(token).digest();
    const baleHash = createHmac('sha256', baleSecret).update(dataCheckString).digest('hex');
    const telegramHash = createHmac('sha256', telegramSecret)
      .update(dataCheckString)
      .digest('hex');
    expect(computeInitDataHash(token, dataCheckString)).toBe(baleHash);
    expect(computeInitDataHash(token, dataCheckString)).not.toBe(telegramHash);
  });
});

import { createHmac } from 'crypto';
import {
  buildDataCheckString,
  computeInitDataHash,
  InitDataError,
  verifyBaleInitData,
} from './init-data';

function signedInitData(token: string, fields: Record<string, string>) {
  const pairs = Object.entries(fields);
  const dataCheckString = buildDataCheckString([...pairs, ['hash', 'ignored']]);
  const hash = computeInitDataHash(token, dataCheckString);
  return new URLSearchParams({ ...fields, hash }).toString();
}

function invertedKeyHash(token: string, dataCheckString: string) {
  const secretKey = createHmac('sha256', token).update('WebAppData').digest();
  return createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
}

describe('verifyBaleInitData', () => {
  const token = '100:test-token-not-for-production';
  const user = JSON.stringify({ id: 42, first_name: 'علی', username: 'ali' });

  it('accepts HMAC-SHA256 signed initData using WebAppData as the HMAC key', () => {
    const initData = signedInitData(token, {
      auth_date: '1700000000',
      query_id: 'AAE',
      user,
    });
    const verified = verifyBaleInitData(initData, token, 1700000000, 60);
    expect(verified.user.id).toBe(42);
    expect(verified.user.username).toBe('ali');
    expect(verified.user.first_name).toBe('علی');
    expect(verified.queryId).toBe('AAE');
  });

  it('accepts URL-encoded initData without mutating field values', () => {
    const initData = signedInitData(token, {
      auth_date: '1700000000',
      user,
    });
    expect(initData).toContain('user=%7B');
    expect(initData).toContain('%D8%B9%D9%84%DB%8C');
    const verified = verifyBaleInitData(initData, token, 1700000000, 60);
    expect(verified.user.id).toBe(42);
    expect(verified.user.first_name).toBe('علی');
  });

  it('rejects a tampered hash', () => {
    const initData = signedInitData(token, {
      auth_date: '1700000000',
      user,
    }).replace(/hash=[^&]+/, 'hash=deadbeef');
    expect(() => verifyBaleInitData(initData, token, 1700000000, 60)).toThrow(
      'امضای دادهٔ بله معتبر نیست.',
    );
    try {
      verifyBaleInitData(initData, token, 1700000000, 60);
    } catch (error) {
      expect(error).toMatchObject({ name: 'InitDataError', code: 'invalid_signature' });
    }
  });

  it('rejects data signed with the inverted HMAC key order', () => {
    const fields = {
      auth_date: '1700000000',
      user,
    };
    const dataCheckString = buildDataCheckString(Object.entries(fields));
    const hash = invertedKeyHash(token, dataCheckString);
    const initData = new URLSearchParams({ ...fields, hash }).toString();
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
    try {
      verifyBaleInitData(initData, token, 1700000000, 60);
    } catch (error) {
      expect(error).toBeInstanceOf(InitDataError);
      expect((error as InitDataError).code).toBe('expired');
    }
  });

  it('rejects empty initData with the empty code', () => {
    try {
      verifyBaleInitData('  ', token, 1700000000, 60);
      throw new Error('expected InitDataError');
    } catch (error) {
      expect(error).toBeInstanceOf(InitDataError);
      expect((error as InitDataError).code).toBe('empty');
      expect((error as InitDataError).message).toBe('initData خالی است.');
    }
  });

  it('rejects missing hash', () => {
    try {
      verifyBaleInitData('auth_date=1700000000&user=%7B%22id%22%3A42%7D', token, 1700000000, 60);
      throw new Error('expected InitDataError');
    } catch (error) {
      expect(error).toBeInstanceOf(InitDataError);
      expect((error as InitDataError).code).toBe('missing_hash');
    }
  });

  it('derives the secret key as HMAC(key=WebAppData, msg=bot_token)', () => {
    const dataCheckString = 'auth_date=1\nuser={"id":1}';
    const protocolSecret = createHmac('sha256', 'WebAppData').update(token).digest();
    const invertedSecret = createHmac('sha256', token).update('WebAppData').digest();
    const protocolHash = createHmac('sha256', protocolSecret).update(dataCheckString).digest('hex');
    const invertedHash = createHmac('sha256', invertedSecret).update(dataCheckString).digest('hex');
    expect(computeInitDataHash(token, dataCheckString)).toBe(protocolHash);
    expect(computeInitDataHash(token, dataCheckString)).not.toBe(invertedHash);
  });
});

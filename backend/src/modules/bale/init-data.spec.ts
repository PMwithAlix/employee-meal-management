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

  it('matches an independent Python hmac test vector', () => {
    // Generated with Python 3.11 hmac/hashlib, not with computeInitDataHash:
    // secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    // expected = hmac.new(secret, data_check_string.encode(), hashlib.sha256).hexdigest()
    const dataCheckString = 'auth_date=1700000000\nquery_id=AAE\nuser={"id":42,"first_name":"Ali"}';
    const expectedHash = '838f4be7d9e5334cfb96755c41a7ffdf82857a1609707c25e6e34656729d356f';
    expect(computeInitDataHash(token, dataCheckString)).toBe(expectedHash);

    const initData =
      'auth_date=1700000000&query_id=AAE&user=%7B%22id%22%3A42%2C%22first_name%22%3A%22Ali%22%7D&hash=' +
      expectedHash;
    const verified = verifyBaleInitData(initData, token, 1700000000, 60);
    expect(verified.user.id).toBe(42);
    expect(verified.user.first_name).toBe('Ali');
    expect(verified.queryId).toBe('AAE');
    expect(verified.authDate).toBe(1700000000);
  });

  it('builds the data-check string with lexicographic keys and decoded values', () => {
    expect(
      buildDataCheckString([
        ['user', '{"id":1}'],
        ['hash', 'deadbeef'],
        ['query_id', 'AAE'],
        ['auth_date', '1700000000'],
        ['empty', ''],
      ]),
    ).toBe('auth_date=1700000000\nempty=\nquery_id=AAE\nuser={"id":1}');
  });

  it('rejects a valid signature after a field is modified', () => {
    const expectedHash = '838f4be7d9e5334cfb96755c41a7ffdf82857a1609707c25e6e34656729d356f';
    const initData =
      'auth_date=1700000000&query_id=AAE&user=%7B%22id%22%3A99%2C%22first_name%22%3A%22Ali%22%7D&hash=' +
      expectedHash;
    expect(() => verifyBaleInitData(initData, token, 1700000000, 60)).toThrow(
      'امضای دادهٔ بله معتبر نیست.',
    );
  });

  it('accepts an uppercase hex hash using a timing-safe compare', () => {
    const expectedHash = '838F4BE7D9E5334CFB96755C41A7FFDF82857A1609707C25E6E34656729D356F';
    const initData =
      'auth_date=1700000000&query_id=AAE&user=%7B%22id%22%3A42%2C%22first_name%22%3A%22Ali%22%7D&hash=' +
      expectedHash;
    expect(verifyBaleInitData(initData, token, 1700000000, 60).user.id).toBe(42);
  });
});

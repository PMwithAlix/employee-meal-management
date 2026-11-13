import {
  createSessionToken,
  hashSessionToken,
  sessionTokensEqual,
} from './session-token';

describe('session token helpers', () => {
  it('creates a unique high-entropy token', () => {
    const a = createSessionToken();
    const b = createSessionToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it('stores a hash that is not the raw token', () => {
    const raw = createSessionToken();
    const hashed = hashSessionToken(raw);
    expect(hashed).not.toEqual(raw);
    expect(hashed).toHaveLength(64);
    expect(sessionTokensEqual(hashed, hashSessionToken(raw))).toBe(true);
  });
});

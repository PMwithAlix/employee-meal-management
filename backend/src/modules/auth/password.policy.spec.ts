import { passwordIssue } from './password.policy';

describe('passwordIssue', () => {
  it('accepts the product password policy', () => {
    expect(passwordIssue('Kavosh-1405')).toBe('');
  });

  it('rejects short, letter-only, and digit-only values', () => {
    expect(passwordIssue('Ab1')).toContain('۸');
    expect(passwordIssue('password')).toContain('رقم');
    expect(passwordIssue('12345678')).toContain('حرف');
  });
});

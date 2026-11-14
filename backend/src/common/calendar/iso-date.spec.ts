import {
  canBypassEmployeeDeadline,
  employeeDeadlineOpen,
  parseGregorianDateOnly,
} from './iso-date';

describe('iso-date and deadlines', () => {
  it('parses Gregorian DATE-only values as UTC midnight', () => {
    const parsed = parseGregorianDateOnly('2026-08-23');
    expect(parsed.toISOString()).toBe('2026-08-23T00:00:00.000Z');
  });

  it('treats the exact deadline instant as closed for employees', () => {
    const deadline = new Date('2026-08-22T06:30:00.000Z');
    expect(employeeDeadlineOpen(deadline, deadline)).toBe(false);
    expect(
      employeeDeadlineOpen(deadline, new Date('2026-08-22T06:29:59.999Z')),
    ).toBe(true);
  });

  it('lets SUPPORT and ADMIN bypass the employee deadline', () => {
    expect(canBypassEmployeeDeadline('SUPPORT')).toBe(true);
    expect(canBypassEmployeeDeadline('ADMIN')).toBe(true);
    expect(canBypassEmployeeDeadline('EMPLOYEE')).toBe(false);
    expect(canBypassEmployeeDeadline('HR')).toBe(false);
  });
});

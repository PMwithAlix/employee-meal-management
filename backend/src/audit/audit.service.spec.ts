import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('strips password material from audit payloads', () => {
    const audit = new AuditService({} as never);
    expect(
      audit.sanitize({
        username: 'nahmadi',
        password: 'secret',
        passwordHash: 'hash',
        newPassword: 'Newpass12',
        role: 'EMPLOYEE',
      }),
    ).toEqual({ username: 'nahmadi', role: 'EMPLOYEE' });
  });
});

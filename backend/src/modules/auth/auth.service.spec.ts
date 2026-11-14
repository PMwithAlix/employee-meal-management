import {
  ForbiddenException,
  HttpException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginRateLimiter } from './login-rate-limiter';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

const user = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'nahmadi',
  passwordHash: 'hash',
  role: Role.EMPLOYEE,
  buildingId: '22222222-2222-2222-2222-222222222222',
  isActive: true,
};

function service(overrides?: {
  findUnique?: jest.Mock;
  verify?: jest.Mock;
  consume?: jest.Mock;
}) {
  const prisma = {
    user: {
      findUnique: overrides?.findUnique ?? jest.fn().mockResolvedValue(user),
    },
    $transaction: jest.fn(),
  };
  const passwords = {
    verify: overrides?.verify ?? jest.fn().mockResolvedValue(true),
    dummyVerify: jest.fn().mockResolvedValue(undefined),
    hash: jest.fn().mockResolvedValue('new-hash'),
  } as unknown as PasswordService;
  const sessions = {
    create: jest.fn().mockResolvedValue({
      session: { id: 'sid', expiresAt: new Date('2026-11-13T20:00:00.000Z') },
      rawToken: 'raw-token',
    }),
    attachCookie: jest.fn(),
    clearCookie: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  } as unknown as SessionService;
  const limiter = {
    consume: overrides?.consume ?? jest.fn().mockReturnValue({ allowed: true }),
  } as unknown as LoginRateLimiter;
  return {
    auth: new AuthService(prisma as never, passwords, sessions, limiter),
    prisma,
    passwords,
    sessions,
    limiter,
  };
}

const response = {} as Response;

describe('AuthService', () => {
  it('logs in an active user and never returns a password hash', async () => {
    const { auth, sessions } = service();
    const result = await auth.login(
      { username: '  NAhmadi ', password: 'Kavosh-1405' },
      'ip:nahmadi',
      response,
    );
    expect(result.username).toBe('nahmadi');
    expect(result).not.toHaveProperty('passwordHash');
    expect(sessions.attachCookie).toHaveBeenCalledWith(response, 'raw-token');
  });

  it('returns the same error for a missing user and a wrong password', async () => {
    const missing = service({
      findUnique: jest.fn().mockResolvedValue(null),
    });
    await expect(
      missing.auth.login(
        { username: 'nobody', password: 'Kavosh-1405' },
        'ip:nobody',
        response,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const wrong = service({ verify: jest.fn().mockResolvedValue(false) });
    await expect(
      wrong.auth.login(
        { username: 'nahmadi', password: 'nope' },
        'ip:nahmadi',
        response,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an inactive user after a valid password', async () => {
    const { auth } = service({
      findUnique: jest.fn().mockResolvedValue({ ...user, isActive: false }),
    });
    await expect(
      auth.login(
        { username: 'nahmadi', password: 'Kavosh-1405' },
        'ip:nahmadi',
        response,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rate-limits repeated login attempts', async () => {
    const { auth } = service({
      consume: jest
        .fn()
        .mockReturnValue({ allowed: false, retryAfterMs: 1000 }),
    });
    await expect(
      auth.login(
        { username: 'nahmadi', password: 'Kavosh-1405' },
        'ip:nahmadi',
        response,
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('rejects a password confirmation mismatch', async () => {
    const { auth } = service();
    await expect(
      auth.changePassword(
        {
          ...user,
          sessionId: 'sid',
          sessionExpiresAt: new Date(),
        },
        {
          currentPassword: 'Kavosh-1405',
          newPassword: 'Newpass12',
          confirmNewPassword: 'Mismatch12',
        },
        response,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

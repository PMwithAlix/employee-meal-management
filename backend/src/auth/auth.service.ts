import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../database/prisma.service';
import { AuthUser } from '../common/types/auth-user';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { LoginRateLimiter } from './login-rate-limiter';
import { passwordIssue } from './password.policy';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { normalizeUsername } from './crypto/username';

const INVALID_CREDENTIALS = 'نام کاربری یا رمز عبور صحیح نیست.';
const INACTIVE_ACCOUNT =
  'حساب کاربری شما غیرفعال است. برای پیگیری با واحد منابع انسانی تماس بگیرید.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly limiter: LoginRateLimiter,
  ) {}

  async login(dto: LoginDto, clientKey: string, response: Response) {
    const limited = this.limiter.consume(clientKey);
    if (!limited.allowed) {
      throw new HttpException(
        'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const username = normalizeUsername(dto.username);
    const user = username
      ? await this.prisma.user.findUnique({ where: { username } })
      : null;

    if (!user) {
      await this.passwords.dummyVerify(dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const matches = await this.passwords.verify(
      user.passwordHash,
      dto.password,
    );
    if (!matches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new ForbiddenException(INACTIVE_ACCOUNT);
    }

    const { session, rawToken } = await this.sessions.create(user.id);
    this.sessions.attachCookie(response, rawToken);
    return this.toAuthUser(user, session.id, session.expiresAt);
  }

  me(user: AuthUser) {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      buildingId: user.buildingId,
      expiresAt: user.sessionExpiresAt.toISOString(),
    };
  }

  async logout(user: AuthUser, response: Response) {
    await this.sessions.revoke(user.sessionId);
    this.sessions.clearCookie(response);
    return { ok: true as const };
  }

  async logoutAll(user: AuthUser, response: Response) {
    await this.sessions.revokeAllForUser(user.id);
    this.sessions.clearCookie(response);
    return { ok: true as const };
  }

  async changePassword(
    user: AuthUser,
    dto: ChangePasswordDto,
    response: Response,
  ) {
    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new UnprocessableEntityException(
        'رمز جدید و تکرار آن یکسان نیستند.',
      );
    }

    const policy = passwordIssue(dto.newPassword);
    if (policy) {
      throw new UnprocessableEntityException(policy);
    }

    const stored = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!stored?.isActive) {
      throw new UnauthorizedException();
    }

    const matches = await this.passwords.verify(
      stored.passwordHash,
      dto.currentPassword,
    );
    if (!matches) {
      throw new UnauthorizedException('رمز عبور فعلی صحیح نیست.');
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      await tx.session.deleteMany({ where: { userId: user.id } });
    });
    this.sessions.clearCookie(response);
    return { ok: true as const };
  }

  private toAuthUser(
    user: {
      id: string;
      username: string;
      role: AuthUser['role'];
      buildingId: string | null;
    },
    sessionId: string,
    expiresAt: Date,
  ) {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      buildingId: user.buildingId,
      expiresAt: expiresAt.toISOString(),
    };
  }
}

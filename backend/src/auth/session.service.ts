import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { EnvironmentVariables, NodeEnv } from '../config/env.validation';
import { PrismaService } from '../database/prisma.service';
import { createSessionToken, hashSessionToken } from './crypto/session-token';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  cookieName() {
    return this.config.get('SESSION_COOKIE_NAME', { infer: true });
  }

  ttlSeconds() {
    return this.config.get('SESSION_TTL_SECONDS', { infer: true });
  }

  async create(userId: string) {
    const rawToken = createSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + this.ttlSeconds() * 1000);
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        lastActivityAt: new Date(),
      },
    });
    return { session, rawToken };
  }

  async findActiveByRawToken(rawToken: string) {
    const tokenHash = hashSessionToken(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session) {
      return null;
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session
        .delete({ where: { id: session.id } })
        .catch(() => undefined);
      return null;
    }
    return session;
  }

  async touch(sessionId: string) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() },
    });
  }

  async revoke(sessionId: string) {
    await this.prisma.session
      .delete({ where: { id: sessionId } })
      .catch(() => undefined);
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
  }

  attachCookie(response: Response, rawToken: string) {
    response.cookie(this.cookieName(), rawToken, this.cookieOptions());
  }

  clearCookie(response: Response) {
    response.clearCookie(this.cookieName(), this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    const sameSite = this.config.get('SESSION_SAMESITE', { infer: true });
    const production =
      this.config.get('NODE_ENV', { infer: true }) === NodeEnv.Production;
    return {
      httpOnly: true,
      secure: this.config.get('SESSION_SECURE', { infer: true }) ?? production,
      sameSite,
      path: this.config.get('SESSION_COOKIE_PATH', { infer: true }),
      maxAge: this.ttlSeconds() * 1000,
    };
  }
}

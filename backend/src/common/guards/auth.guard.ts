import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SessionService } from '../../auth/session.service';
import { readCookie } from '../../auth/crypto/cookies';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const rawToken = readCookie(request, this.sessions.cookieName());
    if (!rawToken) {
      throw new UnauthorizedException('برای ادامه باید وارد سامانه شوید.');
    }

    const session = await this.sessions.findActiveByRawToken(rawToken);
    if (!session || !session.user.isActive) {
      throw new UnauthorizedException('برای ادامه باید وارد سامانه شوید.');
    }

    await this.sessions.touch(session.id);
    request.authUser = {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role,
      buildingId: session.user.buildingId,
      sessionId: session.id,
      sessionExpiresAt: session.expiresAt,
    };
    return true;
  }
}

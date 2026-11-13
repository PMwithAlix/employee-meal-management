import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class LoginRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  consume(key: string) {
    const now = Date.now();
    const windowMs =
      this.config.get('LOGIN_RATE_LIMIT_WINDOW_SECONDS', { infer: true }) *
      1000;
    const max = this.config.get('LOGIN_RATE_LIMIT_MAX', { infer: true });
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true };
    }
    current.count += 1;
    if (current.count > max) {
      return { allowed: false, retryAfterMs: current.resetAt - now };
    }
    return { allowed: true };
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import argon2 from 'argon2';
import { EnvironmentVariables } from '../config/env.validation';

@Injectable()
export class PasswordService {
  private dummyHash?: string;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.config.get('ARGON2_MEMORY_KIB', { infer: true }),
      timeCost: this.config.get('ARGON2_TIME_COST', { infer: true }),
      parallelism: this.config.get('ARGON2_PARALLELISM', { infer: true }),
    });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  async dummyVerify(password: string): Promise<void> {
    const hash = await this.dummy();
    await this.verify(hash, password);
  }

  private async dummy(): Promise<string> {
    this.dummyHash ??= await this.hash('khaan-dummy-password-not-used');
    return this.dummyHash;
  }
}

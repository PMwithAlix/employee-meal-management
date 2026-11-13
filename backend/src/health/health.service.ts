import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../database/prisma.service';

export type HealthStatus = {
  status: 'ok' | 'error';
  database: 'up' | 'down';
  timestamp: string;
  environment: string;
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async check(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const environment = this.config.get('NODE_ENV', { infer: true });

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'up',
        timestamp,
        environment,
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        timestamp,
        environment,
      });
    }
  }
}

import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';
import { PrismaService } from '../database/prisma.service';

describe('HealthService', () => {
  const config = {
    get: () => 'test',
  } as unknown as ConfigService;

  it('reports ok when the database query succeeds', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;
    const service = new HealthService(prisma, config);

    await expect(service.check()).resolves.toMatchObject({
      status: 'ok',
      database: 'up',
      environment: 'test',
    });
  });

  it('throws 503 when the database query fails', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as PrismaService;
    const service = new HealthService(prisma, config);

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

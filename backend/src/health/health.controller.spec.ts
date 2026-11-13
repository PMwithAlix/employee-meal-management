import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService, HealthStatus } from './health.service';

describe('HealthController', () => {
  it('returns the health payload from the service', async () => {
    const payload: HealthStatus = {
      status: 'ok',
      database: 'up',
      timestamp: '2026-11-13T00:00:00.000Z',
      environment: 'test',
    };
    const health = {
      check: jest.fn().mockResolvedValue(payload),
    } as unknown as HealthService;
    const controller = new HealthController(health);

    await expect(controller.check()).resolves.toEqual(payload);
  });

  it('propagates database unavailability', async () => {
    const health = {
      check: jest
        .fn()
        .mockRejectedValue(
          new ServiceUnavailableException({ database: 'down' }),
        ),
    } as unknown as HealthService;
    const controller = new HealthController(health);

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

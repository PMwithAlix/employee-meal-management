import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EnvironmentVariables } from '../src/config/env.validation';
import { PrismaService } from '../src/database/prisma.service';

describe('Application foundation (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn(),
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    prisma.$queryRaw.mockReset();
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, app.get(ConfigService<EnvironmentVariables, true>));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('starts the Nest application', () => {
    expect(app).toBeDefined();
  });

  it('GET /api/v1/health reports a live database check', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      database: 'up',
      environment: 'test',
    });
    expect((response.body as { timestamp: string }).timestamp).toEqual(
      expect.any(String),
    );
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('GET /api/v1/health returns 503 when the database is unavailable', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'error',
      database: 'down',
      statusCode: 503,
    });
  });

  it('does not treat a thrown ServiceUnavailableException as a 500', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(
      new ServiceUnavailableException('down'),
    );

    const response = await request(app.getHttpServer()).get('/api/v1/health');
    expect(response.status).toBe(503);
  });
});

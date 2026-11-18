import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BaleController } from './bale.controller';
import { BaleService } from './bale.service';
import { baleWebhookPathToken } from './webhook-secret';

describe('BaleController webhook routing', () => {
  let app: INestApplication;
  const token = baleWebhookPathToken('webhook-secret-value');
  const bale = {
    handleWebhook: jest.fn().mockResolvedValue({ ok: true, duplicate: false }),
    syncWebhook: jest.fn().mockResolvedValue({ ok: true, result: true }),
    webhookInfo: jest.fn().mockResolvedValue({ ok: true, result: { url: '' } }),
    status: jest.fn().mockReturnValue({ enabled: true }),
    login: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BaleController],
      providers: [{ provide: BaleService, useValue: bale }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a webhook that has no secret path', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/bale/webhook')
      .send({ update_id: 1, message: { text: '/start' } })
      .expect(404);
    expect(bale.handleWebhook).not.toHaveBeenCalled();
  });

  it('delivers an update only through the secret path', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bale/webhook/${token}`)
      .send({ update_id: 7, message: { text: '/start', chat: { id: 5 } } })
      .expect(200);
    expect(bale.handleWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ update_id: 7 }),
      token,
    );
  });

  it('keeps webhook sync off the public secret path', async () => {
    await request(app.getHttpServer()).post('/api/v1/bale/webhook/sync').send({}).expect(200);
    expect(bale.syncWebhook).toHaveBeenCalled();
    expect(bale.handleWebhook).not.toHaveBeenCalled();
  });
});

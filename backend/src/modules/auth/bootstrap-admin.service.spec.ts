import { Role } from '@prisma/client';
import { NodeEnv } from '../../config/env.validation';
import { BootstrapAdminService } from './bootstrap-admin.service';
import {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
} from './default-admin';

function service(overrides?: {
  count?: number;
  enabled?: boolean;
  username?: string;
  password?: string;
  adminExists?: boolean;
}) {
  const prisma = {
    user: {
      count: jest.fn().mockResolvedValue(overrides?.count ?? 0),
      findUnique: jest
        .fn()
        .mockResolvedValue(overrides?.adminExists ? { id: 'existing-admin' } : null),
      create: jest.fn().mockResolvedValue({ username: DEFAULT_ADMIN_USERNAME }),
    },
  };
  const passwords = {
    hash: jest.fn().mockResolvedValue('hashed-admin'),
  };
  const store = {
    BOOTSTRAP_ADMIN_ENABLED: overrides?.enabled ?? true,
    BOOTSTRAP_ADMIN_USERNAME: overrides?.username ?? DEFAULT_ADMIN_USERNAME,
    BOOTSTRAP_ADMIN_PASSWORD: overrides?.password ?? DEFAULT_ADMIN_PASSWORD,
    NODE_ENV: NodeEnv.Development,
  };
  const config = {
    get: jest.fn((key: keyof typeof store) => store[key]),
  };
  return {
    bootstrap: new BootstrapAdminService(
      prisma as never,
      passwords as never,
      config as never,
    ),
    prisma,
    passwords,
  };
}

describe('BootstrapAdminService', () => {
  it('creates the default admin when the user table is empty', async () => {
    const { bootstrap, prisma, passwords } = service();
    await expect(bootstrap.ensureInitialAdmin()).resolves.toBe('created');
    expect(passwords.hash).toHaveBeenCalledWith(DEFAULT_ADMIN_PASSWORD);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: DEFAULT_ADMIN_USERNAME,
          role: Role.ADMIN,
          buildingId: null,
        }),
      }),
    );
  });

  it('creates the default admin when other users exist but that username does not', async () => {
    const { bootstrap, prisma } = service({ count: 3, adminExists: false });
    await expect(bootstrap.ensureInitialAdmin()).resolves.toBe('created');
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('skips when the bootstrap username already exists', async () => {
    const { bootstrap, prisma } = service({ adminExists: true, count: 3 });
    await expect(bootstrap.ensureInitialAdmin()).resolves.toBe('skipped');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('does nothing on startup when bootstrap is disabled', async () => {
    const { bootstrap, prisma } = service({ enabled: false });
    await bootstrap.onModuleInit();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

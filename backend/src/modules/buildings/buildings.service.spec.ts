import { ConflictException, NotFoundException } from '@nestjs/common';
import { BuildingsService } from './buildings.service';

const actor = {
  id: '11111111-1111-1111-1111-111111111111',
  role: 'ADMIN',
} as never;
const buildingId = '22222222-2222-2222-2222-222222222222';

function setup(options?: { activeUsers?: number; locked?: Array<{ id: string }>; initialActive?: boolean }) {
  const current = {
    id: buildingId,
    name: 'ساختمان مرکزی',
    isActive: options?.initialActive ?? true,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue(options?.locked ?? [{ id: buildingId }]),
    building: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(current),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ ...current, ...data }),
      ),
    },
    user: {
      count: jest.fn().mockResolvedValue(options?.activeUsers ?? 0),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    building: {
      findUnique: jest.fn().mockResolvedValue({ ...current, isActive: false }),
    },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new BuildingsService(prisma as never, audit as never),
    prisma,
    tx,
    audit,
    current,
  };
}

describe('BuildingsService unique names', () => {
  it('rejects a second building with the same name', async () => {
    const tx = {
      building: {
        findFirst: jest.fn().mockResolvedValue({ id: buildingId }),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const audit = { record: jest.fn() };
    const service = new BuildingsService(prisma as never, audit as never);

    await expect(
      service.create(actor, { name: '  دهقان  ' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.building.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('allows renaming a building to its current name', async () => {
    const current = {
      id: buildingId,
      name: 'دهقان',
      isActive: true,
    };
    const tx = {
      building: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(current),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      building: {
        findUnique: jest.fn().mockResolvedValue(current),
      },
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new BuildingsService(prisma as never, audit as never);

    await expect(
      service.update(actor, buildingId, { name: 'دهقان' }),
    ).resolves.toMatchObject({ id: buildingId, name: 'دهقان' });
    expect(tx.building.findFirst).toHaveBeenCalledWith({
      where: {
        name: { equals: 'دهقان', mode: 'insensitive' },
        id: { not: buildingId },
      },
      select: { id: true },
    });
  });
});

describe('BuildingsService activation lifecycle', () => {
  it('blocks deactivation while active users are assigned', async () => {
    const { service, tx, audit } = setup({ activeUsers: 2 });

    await expect(service.deactivate(actor, buildingId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.building.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('deactivates an empty building and records the audit event', async () => {
    const { service, tx, audit } = setup({ activeUsers: 0 });

    await expect(service.deactivate(actor, buildingId)).resolves.toMatchObject({
      id: buildingId,
      isActive: false,
    });
    expect(tx.user.count).toHaveBeenCalledWith({
      where: { buildingId, isActive: true },
    });
    expect(tx.building.update).toHaveBeenCalledWith({
      where: { id: buildingId },
      data: { isActive: false },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: actor.id,
        action: 'BUILDING_DEACTIVATED',
        entityId: buildingId,
      }),
      tx,
    );
  });


  it('keeps an already inactive building unchanged without writing another audit event', async () => {
    const { service, tx, audit, current } = setup({ initialActive: false });

    await expect(service.deactivate(actor, buildingId)).resolves.toEqual(current);
    expect(tx.user.count).not.toHaveBeenCalled();
    expect(tx.building.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('does not deactivate a missing building', async () => {
    const { service, tx } = setup({ locked: [] });

    await expect(service.deactivate(actor, buildingId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.user.count).not.toHaveBeenCalled();
    expect(tx.building.update).not.toHaveBeenCalled();
  });

  it('reactivates an inactive building and records the audit event', async () => {
    const { service, tx, audit } = setup({ initialActive: false });

    await expect(service.reactivate(actor, buildingId)).resolves.toMatchObject({
      id: buildingId,
      isActive: true,
    });
    expect(tx.building.update).toHaveBeenCalledWith({
      where: { id: buildingId },
      data: { isActive: true },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'BUILDING_REACTIVATED',
        entityId: buildingId,
      }),
      tx,
    );
  });
});

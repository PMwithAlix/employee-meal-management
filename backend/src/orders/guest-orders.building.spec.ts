import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { GuestOrdersService } from './guest-orders.service';

const actor = { id: '11111111-1111-1111-1111-111111111111', role: 'SUPPORT' } as never;
const buildingId = '22222222-2222-2222-2222-222222222222';

function setup(building: { id: string; name: string; isActive: boolean } | null) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    building: {
      findUnique: jest.fn().mockResolvedValue(building),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return {
    service: new GuestOrdersService(prisma as never, {} as never),
    tx,
  };
}

describe('GuestOrdersService building eligibility', () => {
  const dto = {
    buildingId,
    mealDate: '2026-11-15',
    mealType: 'LUNCH',
    menuItemId: '33333333-3333-3333-3333-333333333333',
    quantity: 2,
  } as never;

  it('rejects guest orders for inactive buildings', async () => {
    const { service, tx } = setup({ id: buildingId, name: 'مرکزی', isActive: false });

    await expect(service.create(actor, dto)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(tx.$queryRaw).toHaveBeenCalled();
  });

  it('returns not found for an unknown building', async () => {
    const { service } = setup(null);

    await expect(service.create(actor, dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

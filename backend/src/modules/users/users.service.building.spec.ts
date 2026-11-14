import { UnprocessableEntityException } from '@nestjs/common';
import { UsersService } from './users.service';

const userId = '11111111-1111-1111-1111-111111111111';
const buildingId = '22222222-2222-2222-2222-222222222222';
const actor = { id: '33333333-3333-3333-3333-333333333333', role: 'ADMIN' } as never;

describe('UsersService inactive building guard', () => {
  it('does not reactivate a user while their assigned building is inactive', async () => {
    const current = {
      id: userId,
      username: 'employee.one',
      role: 'EMPLOYEE',
      buildingId,
      isActive: false,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: buildingId, isActive: false }]),
      user: { update: jest.fn() },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new UsersService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.reactivate(actor, userId)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('rejects creating a user assigned to an inactive building', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: buildingId, isActive: false }]),
      user: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const passwords = { hash: jest.fn().mockResolvedValue('password-hash') };
    const service = new UsersService(
      prisma as never,
      passwords as never,
      {} as never,
      {} as never,
    );

    await expect(service.create(actor, {
      username: 'employee.new',
      password: 'Password123',
      role: 'EMPLOYEE',
      buildingId,
    } as never)).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('rejects moving an existing user to an inactive building', async () => {
    const current = {
      id: userId,
      username: 'employee.one',
      role: 'EMPLOYEE',
      buildingId: '44444444-4444-4444-4444-444444444444',
      isActive: true,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: buildingId, isActive: false }]),
      user: { update: jest.fn() },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new UsersService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.update(actor, userId, { buildingId } as never)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

});

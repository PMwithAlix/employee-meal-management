import { describe, expect, it } from 'vitest';
import { employeeBuildingCounts } from './useHrOverviewData';

describe('employeeBuildingCounts', () => {
  it('counts active employees by building and keeps empty buildings visible', () => {
    const buildings = [
      { id: 'b1', name: 'ساختمان یک' },
      { id: 'b2', name: 'ساختمان دو' },
    ];
    const employees = [
      { id: 'u1', username: 'one', role: 'EMPLOYEE', buildingId: 'b1', buildingName: 'ساختمان یک', isActive: true, createdAt: '2026-11-01T00:00:00.000Z' },
      { id: 'u2', username: 'two', role: 'EMPLOYEE', buildingId: 'b1', buildingName: 'ساختمان یک', isActive: true, createdAt: '2026-11-01T00:00:00.000Z' },
      { id: 'u3', username: 'three', role: 'EMPLOYEE', buildingId: 'b2', buildingName: 'ساختمان دو', isActive: false, createdAt: '2026-11-01T00:00:00.000Z' },
    ];

    expect(employeeBuildingCounts(buildings, employees)).toEqual([
      { id: 'b1', name: 'ساختمان یک', count: 2 },
      { id: 'b2', name: 'ساختمان دو', count: 0 },
    ]);
  });
});

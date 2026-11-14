import { useEffect, useState } from 'react';
import { AuthRequestError } from '../auth/errors';
import { buildingApi, type BuildingSummary } from '../buildings/client';
import { groupApi, type DirectoryGroup } from '../groups/client';
import { userApi, type DirectoryUser } from '../users/client';

export function employeeBuildingCounts(
  buildings: BuildingSummary[],
  employees: DirectoryUser[],
) {
  return buildings.map((building) => ({
    id: building.id,
    name: building.name,
    count: employees.filter(
      (employee) => employee.isActive && employee.buildingId === building.id,
    ).length,
  }));
}

export function useHrOverviewData() {
  const [boot, setBoot] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [employees, setEmployees] = useState<DirectoryUser[]>([]);
  const [buildings, setBuildings] = useState<BuildingSummary[]>([]);
  const [groups, setGroups] = useState<DirectoryGroup[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setMessage('');
    setEmployees([]);
    setBuildings([]);
    setGroups([]);
    void Promise.all([
      userApi.listAll({ role: 'EMPLOYEE' }, controller.signal),
      buildingApi.list(controller.signal),
      groupApi.list(controller.signal),
    ]).then(([listedEmployees, listedBuildings, listedGroups]) => {
      if (controller.signal.aborted) return;
      setEmployees(listedEmployees.items);
      setBuildings(listedBuildings);
      setGroups(listedGroups);
      setStatus('ready');
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setStatus('error');
      setMessage(
        error instanceof AuthRequestError
          ? error.message
          : 'بارگذاری اطلاعات منابع انسانی انجام نشد.',
      );
    });
    return () => controller.abort();
  }, [boot]);

  return {
    status,
    message,
    employees,
    buildings,
    groups,
    retry: () => setBoot((value) => value + 1),
  };
}

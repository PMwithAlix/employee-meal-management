import { MenuVersionStatus } from '@prisma/client';

export function itemsFromPublishedMenu<T>(menu: {
  publishedVersionId: string | null;
  publishedVersion: {
    id: string;
    status: MenuVersionStatus;
    items: T[];
  } | null;
} | null): T[] {
  const version = menu?.publishedVersion;
  if (!menu?.publishedVersionId || !version) return [];
  if (version.id !== menu.publishedVersionId) return [];
  if (version.status !== MenuVersionStatus.PUBLISHED) return [];
  return version.items;
}

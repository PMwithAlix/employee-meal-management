import { itemsFromLiveMenu } from '../menus/live-menu';

export function itemsFromCurrentMenu<T>(menu: {
  versions?: Array<{ items?: T[] }>;
} | null): T[] {
  return itemsFromLiveMenu(menu);
}

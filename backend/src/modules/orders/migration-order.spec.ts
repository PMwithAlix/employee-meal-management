import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const migrationsDir = join(__dirname, '../../../prisma/migrations');

function migrationFolders() {
  return readdirSync(migrationsDir).filter((name) => /^\d{14}_/.test(name));
}

describe('prisma migration order', () => {
  it('runs timestamped folders in lexicographic order', () => {
    const names = migrationFolders();
    expect(names.length).toBeGreaterThanOrEqual(3);
    expect(names).toEqual([...names].sort());
    expect(names[0]).toBe('20261113163606_init_domain_schema');
    expect(
      names.indexOf('20261113173000_guest_order_menu_snapshots'),
    ).toBeLessThan(
      names.indexOf('20261113191000_guest_order_legacy_nullable_snapshots'),
    );
  });

  it('adds guest-order snapshot columns as nullable before any NOT NULL enforcement', () => {
    const additive = readFileSync(
      join(
        migrationsDir,
        '20261113173000_guest_order_menu_snapshots',
        'migration.sql',
      ),
      'utf8',
    );
    expect(additive).toMatch(/ADD COLUMN IF NOT EXISTS "menuItemId"/);
    expect(additive).not.toMatch(/ADD COLUMN "menuItemId" UUID NOT NULL/);
    expect(additive).toMatch(/ON DELETE RESTRICT/);
  });
});

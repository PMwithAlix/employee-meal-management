import { ConfigService } from '@nestjs/config';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const config = {
    get: (key: string) => {
      if (key === 'ARGON2_MEMORY_KIB') return 4096;
      if (key === 'ARGON2_TIME_COST') return 1;
      if (key === 'ARGON2_PARALLELISM') return 1;
      return undefined;
    },
  } as unknown as ConfigService;

  const service = new PasswordService(config);

  it('hashes with argon2id and verifies the original password', async () => {
    const hash = await service.hash('Kavosh-1405');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(hash, 'Kavosh-1405')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong-pass1')).resolves.toBe(false);
  });

  it('does not throw on a malformed hash', async () => {
    await expect(service.verify('not-a-hash', 'Kavosh-1405')).resolves.toBe(
      false,
    );
  });
});

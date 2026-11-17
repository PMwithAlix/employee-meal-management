import { ProcessedUpdates } from './processed-updates';

describe('ProcessedUpdates', () => {
  it('runs a successful update once and treats repeats as duplicates', async () => {
    const inbox = new ProcessedUpdates();
    let calls = 0;
    await expect(
      inbox.run(10, async () => {
        calls += 1;
      }),
    ).resolves.toBe('ok');
    await expect(
      inbox.run(10, async () => {
        calls += 1;
      }),
    ).resolves.toBe('duplicate');
    expect(calls).toBe(1);
  });

  it('retries after a failed dispatch', async () => {
    const inbox = new ProcessedUpdates();
    await expect(
      inbox.run(11, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(inbox.hasSucceeded(11)).toBe(false);
    await expect(inbox.run(11, async () => undefined)).resolves.toBe('ok');
  });

  it('collapses concurrent work for the same update id', async () => {
    const inbox = new ProcessedUpdates();
    let calls = 0;
    const work = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
    };
    const [first, second] = await Promise.all([
      inbox.run(12, work),
      inbox.run(12, work),
    ]);
    expect(new Set([first, second])).toEqual(new Set(['ok', 'duplicate']));
    expect(calls).toBe(1);
  });

  it('lets a waiter retry after a concurrent failure', async () => {
    const inbox = new ProcessedUpdates();
    let calls = 0;
    const first = inbox.run(13, async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      throw new Error('boom');
    });
    const second = (async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return inbox.run(13, async () => {
        calls += 1;
      });
    })();
    await expect(first).rejects.toThrow('boom');
    await expect(second).resolves.toBe('ok');
    expect(calls).toBe(2);
  });

  it('forgets successes when a new process starts', async () => {
    const first = new ProcessedUpdates();
    await first.run(99, async () => undefined);
    expect(first.hasSucceeded(99)).toBe(true);
    expect(new ProcessedUpdates().hasSucceeded(99)).toBe(false);
  });

  it('runs distinct update ids independently', async () => {
    const inbox = new ProcessedUpdates();
    await expect(inbox.run(1, async () => undefined)).resolves.toBe('ok');
    await expect(inbox.run(2, async () => undefined)).resolves.toBe('ok');
  });
});

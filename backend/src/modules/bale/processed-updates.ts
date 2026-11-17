export class ProcessedUpdates {
  private readonly succeeded = new Set<number>();
  private readonly inflight = new Map<number, Promise<void>>();

  constructor(private readonly maxSize = 4000) {}

  hasSucceeded(updateId: number) {
    return this.succeeded.has(updateId);
  }

  acknowledge(updateId: number) {
    this.markSucceeded(updateId);
  }

  async run(
    updateId: number,
    work: () => Promise<void>,
  ): Promise<'ok' | 'duplicate'> {
    for (;;) {
      if (this.succeeded.has(updateId)) {
        return 'duplicate';
      }

      const pending = this.inflight.get(updateId);
      if (pending) {
        try {
          await pending;
        } catch {
          // First attempt failed; loop and either join a new owner or retry.
        }
        continue;
      }

      let settle!: () => void;
      let fail!: (error: unknown) => void;
      const gate = new Promise<void>((resolve, reject) => {
        settle = resolve;
        fail = reject;
      });
      this.inflight.set(updateId, gate);
      void gate.catch(() => undefined);

      try {
        await work();
        this.markSucceeded(updateId);
        settle();
        return 'ok';
      } catch (error) {
        fail(error);
        throw error;
      } finally {
        this.inflight.delete(updateId);
      }
    }
  }

  private markSucceeded(updateId: number) {
    this.succeeded.add(updateId);
    if (this.succeeded.size <= this.maxSize) {
      return;
    }
    const oldest = this.succeeded.values().next().value;
    if (typeof oldest === 'number') {
      this.succeeded.delete(oldest);
    }
  }
}

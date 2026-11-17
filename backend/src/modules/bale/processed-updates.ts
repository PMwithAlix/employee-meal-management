export class ProcessedUpdates {
  private readonly seen = new Map<number, number>();

  constructor(private readonly maxSize = 4000) {}

  remember(updateId: number) {
    if (this.seen.has(updateId)) {
      return false;
    }
    this.seen.set(updateId, Date.now());
    if (this.seen.size > this.maxSize) {
      const oldest = this.seen.keys().next().value;
      if (typeof oldest === 'number') {
        this.seen.delete(oldest);
      }
    }
    return true;
  }
}

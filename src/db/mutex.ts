/**
 * Keyed in-process async mutex for single-instance concurrency protection
 * during the Google Sheets / Local pilot stage (prevents stock race conditions).
 * Replaced by PostgreSQL row-level locking (SELECT ... FOR UPDATE) in Stage 4.
 */
export class KeyedMutex {
  private queues = new Map<string, Promise<void>>();

  async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });

    const tail = previous.then(() => current);
    this.queues.set(key, tail);

    await previous;
    try {
      return await task();
    } finally {
      releaseCurrent();
      if (this.queues.get(key) === tail) {
        this.queues.delete(key);
      }
    }
  }
}

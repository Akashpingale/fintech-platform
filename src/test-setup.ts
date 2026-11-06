/**
 * Global test setup.
 *
 * The Angular unit-test builder runs specs in Node, where `localStorage` is
 * either absent or behind an experimental flag. Several services persist state
 * through it (theme, session token, offline cache), so we install a minimal
 * in-memory implementation and reset it between tests. Without this, those
 * services silently no-op and their tests cannot assert anything real.
 */

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const storage = new MemoryStorage();

Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  configurable: true,
  writable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});

// A fresh slate per test, so persisted state cannot leak between specs.
beforeEach(() => storage.clear());

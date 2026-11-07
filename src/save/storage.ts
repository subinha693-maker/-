// Storage adapters. The save system only talks to this interface, so a native file adapter
// (e.g. for a packaged mobile app) can replace localStorage without touching save logic.
export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class StorageError extends Error {}

export class LocalStorageAdapter implements StorageAdapter {
  get(key: string) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  set(key: string, value: string) {
    try { window.localStorage.setItem(key, value); }
    catch (e) {
      const quota = e instanceof DOMException && /quota/i.test(e.name + e.message);
      throw new StorageError(quota ? '저장 공간이 부족합니다.' : '이 브라우저에서는 저장소에 쓸 수 없습니다.');
    }
  }
  remove(key: string) {
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

/** In-memory adapter for tests and for environments where storage is blocked. */
export class MemoryAdapter implements StorageAdapter {
  map = new Map<string, string>();
  failNextSetFor: string | null = null;
  get(key: string) { return this.map.get(key) ?? null; }
  set(key: string, value: string) {
    if (this.failNextSetFor && key.endsWith(this.failNextSetFor)) { this.failNextSetFor = null; throw new StorageError('simulated crash'); }
    this.map.set(key, value);
  }
  remove(key: string) { this.map.delete(key); }
}

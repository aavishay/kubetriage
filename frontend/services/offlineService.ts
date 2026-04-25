// Offline cache service using IndexedDB for API response caching
const DB_NAME = 'kubetriage-offline-cache';
const DB_VERSION = 1;
const CACHE_STORE = 'api-cache';
const QUEUE_STORE = 'action-queue';

interface CacheEntry {
  url: string;
  data: unknown;
  timestamp: number;
  etag?: string;
}

interface QueuedAction {
  id: string;
  url: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  timestamp: number;
  retries: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        const cacheStore = db.createObjectStore(CACHE_STORE, { keyPath: 'url' });
        cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const queueStore = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });

  return dbPromise;
}

export async function getCachedResponse(url: string): Promise<CacheEntry | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const store = tx.objectStore(CACHE_STORE);
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result as CacheEntry | undefined;
        if (!result) {
          resolve(null);
          return;
        }
        // Cache expires after 24 hours
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - result.timestamp > maxAge) {
          resolve(null);
          return;
        }
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function cacheResponse(url: string, data: unknown): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      const request = store.put({
        url,
        data,
        timestamp: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Silently fail if IndexedDB is unavailable
  }
}

export async function clearCache(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Silently fail
  }
}

export async function queueAction(
  url: string,
  method: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const request = store.put({
        id: crypto.randomUUID(),
        url,
        method,
        body,
        headers,
        timestamp: Date.now(),
        retries: 0
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Silently fail
  }
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const store = tx.objectStore(QUEUE_STORE);
      const request = store.index('timestamp').openCursor();
      const actions: QueuedAction[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          actions.push(cursor.value);
          cursor.continue();
        } else {
          resolve(actions);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

export async function removeQueuedAction(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Silently fail
  }
}

export async function syncQueuedActions(
  onProgress?: (completed: number, total: number) => void
): Promise<{ completed: number; failed: number }> {
  const actions = await getQueuedActions();
  if (actions.length === 0) return { completed: 0, failed: 0 };

  let completed = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
          ...action.headers
        },
        body: action.body ? JSON.stringify(action.body) : undefined
      });

      if (response.ok) {
        await removeQueuedAction(action.id);
        completed++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    onProgress?.(completed + failed, actions.length);
  }

  return { completed, failed };
}

export async function getCacheStats(): Promise<{ entries: number; queueSize: number }> {
  try {
    const db = await getDB();
    const [entries, queueSize] = await Promise.all([
      new Promise<number>((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readonly');
        const store = tx.objectStore(CACHE_STORE);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
      new Promise<number>((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readonly');
        const store = tx.objectStore(QUEUE_STORE);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
    ]);
    return { entries, queueSize };
  } catch {
    return { entries: 0, queueSize: 0 };
  }
}

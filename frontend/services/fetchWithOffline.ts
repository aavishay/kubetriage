import { getCachedResponse, cacheResponse, queueAction } from './offlineService';

/**
 * Offline-aware fetch wrapper.
 *
 * For GET requests:
 *   - Always tries network first
 *   - Falls back to IndexedDB cache if offline or request fails
 *   - Writes successful responses to cache
 *
 * For mutating requests (POST, PUT, PATCH, DELETE):
 *   - If online, performs request normally
 *   - If offline, queues the action for later sync
 */
export async function fetchWithOffline(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const method = (options?.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      // Try network first
      const response = await fetch(url, options);
      if (response.ok) {
        // Clone before reading because body can only be consumed once
        const cloned = response.clone();
        try {
          const data = await cloned.json();
          await cacheResponse(url, data);
        } catch {
          // Not JSON, skip caching
        }
      }
      return response;
    } catch {
      // Network failed — try cache
      const cached = await getCachedResponse(url);
      if (cached) {
        return new Response(JSON.stringify(cached.data), {
          status: 200,
          statusText: 'OK (from cache)',
          headers: {
            'Content-Type': 'application/json',
            'X-Cache-Hit': 'true',
            'X-Cache-Timestamp': new Date(cached.timestamp).toUTCString()
          }
        });
      }
      // Nothing cached — return synthetic offline error
      return new Response(
        JSON.stringify({ error: 'You are offline and no cached data is available.' }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }

  // Mutating request
  if (!navigator.onLine) {
    await queueAction(url, method, options?.body, extractHeaders(options?.headers));
    return new Response(
      JSON.stringify({
        queued: true,
        message: 'Action queued and will sync when back online.'
      }),
      {
        status: 202,
        statusText: 'Accepted',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  return fetch(url, options);
}

function extractHeaders(
  headers?: HeadersInit
): Record<string, string> | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((v, k) => { result[k] = v; });
    return result;
  }
  if (Array.isArray(headers)) {
    const result: Record<string, string> = {};
    headers.forEach(([k, v]) => { result[k] = v; });
    return result;
  }
  return headers as Record<string, string>;
}

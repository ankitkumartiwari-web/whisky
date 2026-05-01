import type { Song } from '../data/mockData';

interface SearchSongsResponse {
  source?: string;
  results?: Song[];
  error?: string;
}

const SEARCH_ENDPOINT_CANDIDATES = [
  '/api/search/songs',
  'http://localhost:8787/api/search/songs',
  'http://localhost:8788/api/search/songs',
];

interface CachedSearchEntry {
  expiresAt: number;
  result: { data?: Song[]; source?: string; error?: string };
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const searchCache = new Map<string, CachedSearchEntry>();
const inFlight = new Map<string, Promise<{ data?: Song[]; source?: string; error?: string }>>();

export async function searchSongsOnline(query: string, limit = 12, country = ''): Promise<{
  data?: Song[];
  source?: string;
  error?: string;
}> {
  const cacheKey = `${(country || '').toLowerCase()}|${query.trim().toLowerCase()}|${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const inflight = inFlight.get(cacheKey);
  if (inflight) return inflight;

  const promise = (async () => {
    const result = await runSearchRequest(query, limit, country);
    searchCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
    inFlight.delete(cacheKey);
    return result;
  })();
  inFlight.set(cacheKey, promise);
  return promise;
}

async function runSearchRequest(query: string, limit: number, country: string): Promise<{
  data?: Song[];
  source?: string;
  error?: string;
}> {
  let lastError = 'Unable to fetch online search results right now.';

  for (const endpoint of SEARCH_ENDPOINT_CANDIDATES) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, limit, country }),
      });

      const payload = (await response.json().catch(() => ({}))) as SearchSongsResponse;

      if (response.ok) {
        return {
          data: Array.isArray(payload.results) ? payload.results : [],
          source: typeof payload.source === 'string' ? payload.source : 'none',
        };
      }

      if (response.status !== 404) {
        lastError = typeof payload.error === 'string' ? payload.error : 'Search request failed.';
        break;
      }

      lastError = typeof payload.error === 'string' ? payload.error : 'Search endpoint not found on current server.';
    } catch {
      lastError = 'Unable to reach search service endpoint.';
    }
  }

  return {
    error: lastError,
  };
}

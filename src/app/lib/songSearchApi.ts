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

export async function searchSongsOnline(query: string, limit = 12): Promise<{
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
        body: JSON.stringify({ query, limit }),
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

import type { Playlist, Song } from '../data/mockData';
import { buildAICatalogPayload } from '../data/catalogMetadata';

export interface RecommendationResult {
  songIds: string[];
  source?: 'content-based-ml' | 'hybrid-ml-trinity';
}

export async function getRecommendations(options: {
  songs: Song[];
  playlists: Playlist[];
  likedSongIds: string[];
  recentlyPlayedIds: string[];
  currentSongId: string | null;
  limit?: number;
}): Promise<{ data?: RecommendationResult; error?: string }> {
  try {
    const response = await fetch('/api/recommendations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        catalog: buildAICatalogPayload(options.songs, options.playlists),
        likedSongIds: options.likedSongIds,
        recentlyPlayedIds: options.recentlyPlayedIds,
        currentSongId: options.currentSongId,
        limit: options.limit ?? 8,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === 'string' ? payload.error : 'Recommendation request failed.';
      return { error: message };
    }

    const data = await response.json();
    return { data };
  } catch {
    return { error: 'Unable to reach recommendation service. Please try again.' };
  }
}

import type { Playlist, Song } from '../data/mockData';
import { buildAICatalogPayload } from '../data/catalogMetadata';
import { isBackendApiAvailable } from './backendAvailability';

export interface RecommendationResult {
  songs: Song[];
  songIds?: string[];
  source?: 'content-based-ml' | 'hybrid-ml-trinity' | 'youtube' | 'youtube-trinity' | 'python-ml-service';
}

let recommendationEndpointAvailable: boolean | null = null;

export async function getRecommendations(options: {
  songs: Song[];
  playlists: Playlist[];
  likedSongIds: string[];
  recentlyPlayedIds: string[];
  currentSongId: string | null;
  limit?: number;
}): Promise<{ data?: RecommendationResult; error?: string }> {
  try {
    if (recommendationEndpointAvailable === false) {
      return { error: 'Recommendation service is unavailable.' };
    }

    const backendReady = await isBackendApiAvailable();
    if (!backendReady) {
      recommendationEndpointAvailable = false;
      return { error: 'Recommendation service is unavailable.' };
    }

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
      if (response.status === 404) {
        recommendationEndpointAvailable = false;
      }
      return { error: message };
    }

    recommendationEndpointAvailable = true;

    const payload = await response.json();
    const songs = Array.isArray(payload?.songs) ? payload.songs : [];
    const songIds = Array.isArray(payload?.songIds) ? payload.songIds : [];

    return {
      data: {
        songs,
        songIds,
        source: typeof payload?.source === 'string' ? payload.source : undefined,
      },
    };
  } catch {
    return { error: 'Unable to reach recommendation service. Please try again.' };
  }
}

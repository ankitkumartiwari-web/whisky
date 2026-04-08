import type { Playlist, Song } from '../data/mockData';
import { buildAICatalogPayload } from '../data/catalogMetadata';

export interface AICuratorSuggestion {
  type: 'song' | 'playlist' | 'album';
  id: string;
  reason: string;
}

export interface AICuratorResult {
  intent: string;
  responseText: string;
  suggestions: AICuratorSuggestion[];
  playlistBuilder: {
    name: string;
    description: string;
    songIds: string[];
  };
  rerankedSongIds: string[];
  details: {
    songId: string | null;
    artistName: string | null;
    originTitle: string | null;
  } | null;
  geniusDetails?: {
    title: string;
    artistName: string;
    releaseDate: string | null;
    geniusUrl: string | null;
    annotationCount: number;
  } | null;
  model?: string;
}

export async function getAICuratorResult(options: {
  prompt: string;
  songs: Song[];
  playlists: Playlist[];
  searchResultSongIds: string[];
}): Promise<{ data?: AICuratorResult; error?: string }> {
  try {
    const response = await fetch('/api/ai-curator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: options.prompt,
        catalog: buildAICatalogPayload(options.songs, options.playlists),
        searchResultSongIds: options.searchResultSongIds,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === 'string' ? payload.error : 'AI curator request failed.';
      return { error: message };
    }

    const data = await response.json();
    return { data };
  } catch {
    return { error: 'Unable to reach AI service. Please try again.' };
  }
}

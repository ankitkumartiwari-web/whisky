import type { Song } from '../data/mockData';
import { isBackendApiAvailable } from './backendAvailability';

export interface CuratorFact {
  text: string;
}

export interface CuratorTrack extends Song {
  reason?: string;
}

export interface CuratorPlaylist {
  name: string;
  description: string;
  tracks: CuratorTrack[];
}

export interface CuratorChatResult {
  intent: 'facts' | 'playlist' | 'explain' | 'chat' | string;
  responseText: string;
  facts: string[];
  playlist: CuratorPlaylist | null;
  model?: string;
}

export interface CuratorChatInput {
  prompt: string;
  currentSong?: Song | null;
  likedSongs?: Song[];
  recentSongs?: Song[];
  preferredLanguages?: string[];
  responseLanguage?: 'English' | 'Hindi';
}

export async function chatWithCurator(
  input: CuratorChatInput,
): Promise<{ data?: CuratorChatResult; error?: string }> {
  try {
    const ready = await isBackendApiAvailable();
    if (!ready) {
      return { error: 'AI curator is offline right now. Make sure the API server is running.' };
    }

    const response = await fetch('/api/ai-curator/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: input.prompt,
        currentSong: input.currentSong ?? null,
        likedSongs: input.likedSongs ?? [],
        recentSongs: input.recentSongs ?? [],
        preferredLanguages: input.preferredLanguages ?? [],
        responseLanguage: input.responseLanguage ?? 'English',
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === 'string' ? payload.error : 'AI curator request failed.';
      return { error: message };
    }

    const data = (await response.json()) as CuratorChatResult;
    return { data };
  } catch {
    return { error: 'Unable to reach AI curator service.' };
  }
}

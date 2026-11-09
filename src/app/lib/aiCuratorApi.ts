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

export interface Analysis {
  trend: string;
  genre_mix: string[];
  energy_profile: string;
  time_of_day: string;
  listening_mood: string;
}

export interface SongOfTheDay {
  id: string;
  reason: string;
}

export interface RelatedArtist {
  id: string;
  name: string;
}

export interface CustomAction {
  label: string;
  action: string;
}

export interface PromptAlignment {
  intentMatch: number;
  culturalRelevance: number;
  personalizationScore: number;
  completeness: number;
}

export interface CuratorChatResult {
  intent: 'facts' | 'playlist' | 'explain' | 'chat' | 'analysis' | 'story' | 'mood' | 'time' | string;
  responseText: string;
  facts: string[];
  playlist: CuratorPlaylist | null;
  analysis?: Analysis;
  wisdom?: string;
  songOfTheDay?: SongOfTheDay;
  relatedArtists?: RelatedArtist[];
  customActions?: CustomAction[];
  promptAlignment?: PromptAlignment;
  model?: string;
}

export interface CuratorChatInput {
  prompt: string;
  currentSong?: Song | null;
  likedSongs?: Song[];
  recentSongs?: Song[];
  preferredLanguages?: string[];
  responseLanguage?: 'English' | 'Hindi' | 'Spanish' | 'French' | 'Korean' | 'Tamil' | 'Punjabi';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  userMood?: 'happy' | 'chill' | 'romantic' | 'energetic' | 'focus' | 'workout' | 'party' | 'sad' | 'sleep';
  deviceType?: 'mobile' | 'desktop' | 'web';
}

export async function chatWithCurator(
  input: CuratorChatInput,
): Promise<{ data?: CuratorChatResult; error?: string }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45_000);
  try {
    const ready = await isBackendApiAvailable();
    if (!ready) {
      return { error: 'Maestro is offline right now. Make sure the API server is running.' };
    }

    const response = await fetch('/api/ai-curator/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        prompt: input.prompt,
        currentSong: input.currentSong ?? null,
        likedSongs: input.likedSongs ?? [],
        recentSongs: input.recentSongs ?? [],
        preferredLanguages: input.preferredLanguages ?? [],
        responseLanguage: input.responseLanguage ?? 'English',
        timeOfDay: input.timeOfDay ?? 'evening',
        userMood: input.userMood ?? 'happy',
        deviceType: input.deviceType ?? 'desktop',
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === 'string' ? payload.error : 'Maestro request failed.';
      return { error: message };
    }

    const data = (await response.json()) as CuratorChatResult;
    return { data };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return { error: 'Maestro took too long to answer. Try again in a moment.' };
    }
    return { error: 'Unable to reach Maestro right now.' };
  } finally {
    window.clearTimeout(timeout);
  }
}

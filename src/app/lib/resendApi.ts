import { isBackendApiAvailable } from './backendAvailability';

interface SendWelcomeInput {
  email: string;
  fullName: string;
}

export async function sendWelcomeEmail({ email, fullName }: SendWelcomeInput): Promise<void> {
  try {
    if (!(await isBackendApiAvailable())) return;
    const response = await fetch('/api/send-welcome', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, fullName }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = typeof data?.error === 'string' ? data.error : 'Welcome email request failed.';
      throw new Error(message);
    }
  } catch (error) {
    console.warn('[resend] Welcome email not sent:', error);
  }
}

interface RequestPasswordResetInput {
  email: string;
}

interface LogRecommendationEventInput {
  eventType: 'play' | 'like';
  songId: string;
  likedSongIds?: string[];
  recentlyPlayedIds?: string[];
  currentSongId?: string | null;
}

export async function requestPasswordResetEmail({ email }: RequestPasswordResetInput): Promise<{ error?: string }> {
  try {
    if (!(await isBackendApiAvailable())) {
      return { error: 'Password reset service is unavailable.' };
    }
    const response = await fetch('/api/send-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = typeof data?.error === 'string' ? data.error : 'Password reset email request failed.';
      return { error: message };
    }

    return {};
  } catch {
    return { error: 'Unable to contact email service. Please try again.' };
  }
}

export async function logRecommendationEvent(input: LogRecommendationEventInput): Promise<void> {
  try {
    if (!(await isBackendApiAvailable())) return;
    await fetch('/api/recommendation-history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventType: input.eventType,
        songId: input.songId,
        likedSongIds: input.likedSongIds ?? [],
        recentlyPlayedIds: input.recentlyPlayedIds ?? [],
        currentSongId: input.currentSongId ?? null,
      }),
    });
  } catch {
    // History export is best-effort.
  }
}

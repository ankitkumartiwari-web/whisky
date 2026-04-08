import type { Song } from '../data/mockData';

export const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

export type PlaybackDiagnosticStatus = 'pass' | 'warn' | 'fail';

export interface PlaybackDiagnosticItem {
  key: string;
  label: string;
  status: PlaybackDiagnosticStatus;
  detail: string;
}

export interface PlayerRuntimeDiagnostics {
  mounted: boolean;
  ready: boolean;
  playing: boolean;
  buffering: boolean;
  error: string | null;
  url: string;
  environment: 'electron' | 'browser';
  userAgent: string;
}

export function isValidYouTubeVideoId(videoId: string | null | undefined): videoId is string {
  return typeof videoId === 'string' && YOUTUBE_VIDEO_ID_REGEX.test(videoId);
}

export function getYouTubeWatchUrl(videoId: string | null | undefined): string | null {
  if (!isValidYouTubeVideoId(videoId)) {
    return null;
  }

  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getPlaybackEnvironment(): 'electron' | 'browser' {
  if (typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent)) {
    return 'electron';
  }

  return 'browser';
}

export function createPlaybackChecklist(
  song: Song | null,
  isPlaying: boolean,
  runtime: PlayerRuntimeDiagnostics,
): PlaybackDiagnosticItem[] {
  const videoId = song?.videoId;
  const sourceUrl = getYouTubeWatchUrl(videoId);

  return [
    {
      key: 'data',
      label: 'Data',
      status: song
        ? isValidYouTubeVideoId(videoId)
          ? 'pass'
          : 'fail'
        : 'warn',
      detail: song
        ? isValidYouTubeVideoId(videoId)
          ? `Song and videoId look valid: ${videoId}`
          : 'Song exists but videoId is missing or malformed.'
        : 'No song selected yet.',
    },
    {
      key: 'component',
      label: 'Component',
      status: runtime.mounted ? 'pass' : 'fail',
      detail: runtime.mounted
        ? 'Player component mounted successfully.'
        : 'Player component is not mounted, so playback cannot start.',
    },
    {
      key: 'player',
      label: 'Player State',
      status: runtime.error ? 'fail' : runtime.ready ? 'pass' : 'warn',
      detail: runtime.error
        ? runtime.error
        : `isPlaying=${String(isPlaying)} ready=${String(runtime.ready)} buffering=${String(
            runtime.buffering,
          )} playingEvent=${String(runtime.playing)}`,
    },
    {
      key: 'source',
      label: 'Source',
      status: sourceUrl ? 'pass' : 'fail',
      detail: sourceUrl ?? 'No valid YouTube source URL could be built from the current videoId.',
    },
    {
      key: 'environment',
      label: 'Environment',
      status: runtime.environment === 'browser' ? 'pass' : 'warn',
      detail:
        runtime.environment === 'browser'
          ? 'Running in the browser. Compare this with Electron if playback differs.'
          : 'Running inside Electron. If browser playback works but Electron does not, inspect Electron embed/webPreferences.',
    },
  ];
}

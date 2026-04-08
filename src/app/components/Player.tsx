import React, { useEffect, useMemo, useState } from 'react';
import ReactPlayer from 'react-player';
import {
  getPlaybackEnvironment,
  getYouTubeWatchUrl,
  type PlayerRuntimeDiagnostics,
} from '../lib/playerDiagnostics';

interface PlayerProps {
  videoId?: string;
  isPlaying: boolean;
  onBufferChange?: (isBuffering: boolean) => void;
  onDiagnosticsChange?: (diagnostics: PlayerRuntimeDiagnostics) => void;
  forcePlayback?: boolean;
  compact?: boolean;
}

export const Player = ({
  videoId,
  isPlaying,
  onBufferChange,
  onDiagnosticsChange,
  forcePlayback = false,
  compact = false,
}: PlayerProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasPlayedEvent, setHasPlayedEvent] = useState(false);
  const environment = useMemo(() => getPlaybackEnvironment(), []);
  function isValidVideoId(id: any) {
    return typeof id === 'string' && id.length === 11;
  }
  const url = useMemo(() => isValidVideoId(videoId) ? getYouTubeWatchUrl(videoId) ?? '' : '', [videoId]);
  const shouldPlay = forcePlayback || isPlaying;

  useEffect(() => {
    setIsMounted(true);
    console.log('Player mounted with videoId:', videoId);
  }, [videoId]);

  useEffect(() => {
    console.log('isPlaying:', isPlaying);
  }, [isPlaying]);

  useEffect(() => {
    onDiagnosticsChange?.({
      mounted: isMounted,
      ready: isReady,
      playing: hasPlayedEvent,
      buffering: isBuffering,
      error,
      url,
      environment,
      userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
    });
  }, [environment, error, hasPlayedEvent, isBuffering, isMounted, isReady, onDiagnosticsChange, url]);

  useEffect(() => {
    console.log({
      videoId,
      isPlaying,
      url,
      environment,
      forcePlayback,
    });
  }, [environment, forcePlayback, isPlaying, url, videoId]);

    // No playback logic here; handled by global HiddenPlayer
    return null;
          setHasPlayedEvent(true);
          setIsBuffering(false);
          onBufferChange?.(false);
        }}
        onError={() => {
          setIsBuffering(false);
          setError('Playback failed. This video may be restricted, unavailable, or blocked from embedding.');
          onBufferChange?.(false);
        }}
        config={{
          youtube: {
            playerVars: {
              autoplay: shouldPlay ? 1 : 0,
            },
          },
        }}
      />
      {error && <div className="mt-2 text-xs text-red-500">{error}</div>}
    </div>
  );
};

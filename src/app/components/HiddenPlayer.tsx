import ReactPlayer from "react-player";
import { useEffect, useRef } from "react";
import type { SyntheticEvent } from "react";

interface HiddenPlayerProps {
  audioSrc?: string | null;
  videoId: string | null;
  isPlaying: boolean;
  onProgress?: (seconds: number) => void;
  onEnded?: () => void;
}

export const HiddenPlayer = ({ audioSrc, videoId, isPlaying, onProgress, onEnded }: HiddenPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {
        // Playback may be blocked if there was no valid user interaction.
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, audioSrc]);

  if (audioSrc) {
    return (
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        style={{
          position: 'fixed',
          width: '1px',
          height: '1px',
          opacity: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: -1,
        }}
        aria-hidden="true"
        onTimeUpdate={(event: SyntheticEvent<HTMLAudioElement, Event>) => {
          onProgress?.(event.currentTarget.currentTime);
        }}
        onEnded={onEnded}
      />
    );
  }

  if (!videoId) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        width: "1px",
        height: "1px",
        opacity: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: -1,
      }}
      aria-hidden="true"
    >
      <ReactPlayer
        src={`https://www.youtube.com/watch?v=${videoId}`}
        playing={isPlaying}
        controls={false}
        width="100%"
        height="100%"
        onTimeUpdate={(event: SyntheticEvent<HTMLVideoElement, Event>) => {
          onProgress?.(event.currentTarget.currentTime);
        }}
        onEnded={onEnded}
        onError={(e) => console.error("Player error:", e)}
      />
    </div>
  );
};
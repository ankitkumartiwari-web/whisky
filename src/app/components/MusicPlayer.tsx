import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  Heart,
  Maximize2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Song } from '../data/mockData';
import { Slider } from './ui/slider';
import { motion, AnimatePresence } from 'motion/react';
import type { PlayerRuntimeDiagnostics } from '../lib/playerDiagnostics';

interface MusicPlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  repeatMode: 'off' | 'one' | 'all';
  onVolumeChange: (v: number) => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShowLyrics: () => void;
  onRepeatModeChange: () => void;
  onProgressChange?: (progress: number) => void;
  onDiagnosticsChange?: (diagnostics: PlayerRuntimeDiagnostics) => void;
}

const MusicPlayer = (props: MusicPlayerProps) => {
  const {
    currentSong,
    isPlaying,
    progress: externalProgress,
    repeatMode,
    onPlayPause,
    onNext,
    onPrevious,
    onShowLyrics,
    onRepeatModeChange,
    onProgressChange,
    volume,
    onVolumeChange,
  } = props;

  const [isShuffle, setIsShuffle] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isBuffering] = useState(false);

  useEffect(() => {
    if (currentSong) {
      setIsLiked(currentSong.isLiked);
    }
  }, [currentSong]);



  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentTime = (externalProgress / 100) * (currentSong?.duration ?? 0);
  const totalTime = currentSong?.duration ?? 0;

  if (!currentSong) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-0 left-20 right-0 bg-black/95 backdrop-blur-2xl border-t border-white/10"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30 }}
      >
        <div className="px-8 py-4">
          {/* Playback UI only, audio handled by global HiddenPlayer */}
          <div className="max-w-screen-2xl mx-auto flex items-center gap-8">

            {/* Song Info - Left */}
            <div className="flex items-center gap-4 w-80">
              <motion.button
                onClick={onShowLyrics}
                className="relative w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 group"
                layoutId={`song-${currentSong.id}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <img
                  src={currentSong.coverUrl}
                  alt={currentSong.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="w-5 h-5 text-white" />
                </div>
              </motion.button>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm text-white truncate font-medium">{currentSong.title}</h4>
                <p className="text-xs text-white/60 truncate">{currentSong.artist}</p>
              </div>
              <button
                onClick={() => setIsLiked(!isLiked)}
                className={`transition-colors flex-shrink-0 ${
                  isLiked ? 'text-accent' : 'text-white/40 hover:text-white'
                }`}
              >
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Player Controls - Center */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setIsShuffle(!isShuffle)}
                  className={`transition-colors ${
                    isShuffle ? 'text-accent' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  onClick={onPrevious}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>

                {/* FIX: duplicate JSX block was pasted here inside the ternary, breaking the expression.
                    Restored to a simple three-branch ternary: buffering spinner | pause | play. */}
                <button
                  onClick={onPlayPause}
                  disabled={isBuffering}
                  className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform relative"
                >
                  {isBuffering ? (
                    <svg
                      className="animate-spin h-5 w-5 text-black"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                </button>

                <button
                  onClick={onNext}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>

                <button
                  onClick={onRepeatModeChange}
                  title={
                    repeatMode === 'one'
                      ? 'Repeat one'
                      : repeatMode === 'all'
                        ? 'Repeat all'
                        : 'Repeat off'
                  }
                  className={`transition-colors ${
                    repeatMode !== 'off' ? 'text-accent' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <span className="relative inline-flex items-center justify-center w-6 h-6 overflow-visible">
                    <Repeat className="w-5 h-5" />
                    {repeatMode === 'one' && (
                      <span className="absolute -top-2 -right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[11px] font-extrabold leading-none text-white border border-accent shadow-[0_0_0_2px_rgba(0,0,0,0.55)]">
                        1
                      </span>
                    )}
                    {repeatMode === 'all' && (
                      <span className="absolute -top-2 -right-3 z-20 flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[11px] font-extrabold leading-none text-white border border-accent shadow-[0_0_0_2px_rgba(0,0,0,0.55)]">
                        8
                      </span>
                    )}
                  </span>
                </button>
              </div>

              {/* Progress Slider */}
              <div className="flex items-center gap-3 w-full max-w-2xl">
                <span className="text-xs text-black dark:text-white/60 min-w-[40px] text-right">
                  {formatTime(currentTime)}
                </span>
                <div className="flex-1">
                  <Slider
                    value={[externalProgress]}
                    onValueChange={(value) => {
                      if (onProgressChange) onProgressChange(value[0]);
                    }}
                    max={100}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                <span className="text-xs text-black dark:text-white/60 min-w-[40px]">
                  {formatTime(totalTime)}
                </span>
              </div>
            </div>

            {/* Volume Control - Right */}
            <div className="flex items-center gap-4 w-80 justify-end">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-[color:var(--accent,var(--accent))] dark:text-[color:var(--accent,var(--accent))]" />
                <div className="w-28">
                  <Slider
                    value={[volume]}
                    onValueChange={(value) => onVolumeChange(value[0])}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
              <button
                onClick={onShowLyrics}
                className="text-white/60 hover:text-white transition-colors ml-2"
                title="Show lyrics"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>

          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MusicPlayer;

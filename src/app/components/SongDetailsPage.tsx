import { useEffect, useState, useRef } from 'react';
import { X, Heart, Share2, Plus, Play, Pause, Clock, Disc, Music2, Calendar } from 'lucide-react';
import { Song } from '../data/mockData';
import { motion, AnimatePresence } from 'motion/react';
import { WaveformVisualizer } from './WaveformVisualizer';
import { Skeleton } from './ui/skeleton';
import { getArtistMetadata, getOriginMetadata, getSongMetadata } from '../data/catalogMetadata';
import { fetchGeniusMetadata, type GeniusMetadata } from '../lib/geniusApi';
import {
  createPlaybackChecklist,
  getPlaybackEnvironment,
  getYouTubeWatchUrl,
  isValidYouTubeVideoId,
  type PlayerRuntimeDiagnostics,
} from '../lib/playerDiagnostics';

interface SongDetailsPageProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  isPlaying: boolean;
  progress: number;
  onPlayPause?: () => void;
}

const getAccentColor = (songId: string): string => {
  const colors: Record<string, string> = {
    song1: '#7C3AED',
    song2: '#2563EB',
    song3: '#059669',
  };
  return colors[songId] ?? '#1DB954';
};

export function SongDetailsPage({
  song,
  isOpen,
  onClose,
  isPlaying,
  progress,
  onPlayPause,
}: SongDetailsPageProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [geniusMetadata, setGeniusMetadata] = useState<GeniusMetadata | null>(null);
  const [geniusLyrics, setGeniusLyrics] = useState<string | null>(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const loadingStartedAtRef = useRef<number | null>(null);
  const loadingTimerRef = useRef<number | null>(null);
  const [playerDiagnostics, setPlayerDiagnostics] = useState<PlayerRuntimeDiagnostics>({
    mounted: false,
    ready: false,
    playing: false,
    buffering: false,
    error: null,
    url: '',
    environment: getPlaybackEnvironment(),
    userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
  });
  const lyricsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (song) setIsLiked(song.isLiked ?? false);
  }, [song]);

  useEffect(() => {
    let isMounted = true;

    if (loadingTimerRef.current !== null) {
      window.clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }

    if (!song) {
      setGeniusMetadata(null);
      setGeniusLyrics(null);
      setIsMetadataLoading(false);
      loadingStartedAtRef.current = null;
      return;
    }

    setIsMetadataLoading(true);
    loadingStartedAtRef.current = window.performance.now();
    setGeniusMetadata(null);
    setGeniusLyrics(null);

    fetchGeniusMetadata(song.title, song.artist)
      .then((result) => {
        if (!isMounted) return;
        const metadata = result.data?.metadata ?? null;
        const applyResult = () => {
          if (!isMounted) return;
          setGeniusMetadata(metadata);
          setGeniusLyrics(metadata?.songDescription ?? null);
          setIsMetadataLoading(false);
          loadingStartedAtRef.current = null;
          loadingTimerRef.current = null;
        };

        const startedAt = loadingStartedAtRef.current ?? window.performance.now();
        const elapsed = window.performance.now() - startedAt;
        const remaining = Math.max(180, 320 - elapsed);
        loadingTimerRef.current = window.setTimeout(applyResult, remaining);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Metadata fetch error:', err);
        const startedAt = loadingStartedAtRef.current ?? window.performance.now();
        const elapsed = window.performance.now() - startedAt;
        const remaining = Math.max(180, 320 - elapsed);
        loadingTimerRef.current = window.setTimeout(() => {
          if (!isMounted) return;
          setIsMetadataLoading(false);
          loadingStartedAtRef.current = null;
          loadingTimerRef.current = null;
        }, remaining);
      });
    return () => {
      isMounted = false;
      if (loadingTimerRef.current !== null) {
        window.clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [song]);

  if (!song) return null;

  const accent = getAccentColor(song.id);
  const songMeta = getSongMetadata(song.id);
  const artistMeta = getArtistMetadata(song.artist);
  const originMeta = getOriginMetadata(song.album);
  const playbackChecklist = createPlaybackChecklist(song, isPlaying, playerDiagnostics);
  const completedChecks = playbackChecklist.filter((i) => i.status === 'pass').length;
  const lyricsContent = geniusLyrics;
  const isLyricsLoading = isMetadataLoading || (geniusLyrics === null && geniusMetadata === null);

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const originLabel = songMeta?.originType === 'movie' || originMeta?.type === 'movie' ? 'Movie' : 'Album';
  const artistGenres = artistMeta?.genres ?? [];
  const moodTags = songMeta?.moods ?? [];
  const activityTags = songMeta?.activities ?? [];
  const resolvedGenre = geniusMetadata?.genre ?? songMeta?.genre ?? 'Unknown';
  const resolvedLanguage = geniusMetadata?.language ?? songMeta?.language ?? originMeta?.language ?? 'Unknown';
  const resolvedYear = geniusMetadata?.originYear ?? songMeta?.originYear ?? originMeta?.year ?? null;
  const sourceLabel = geniusMetadata?.source === 'google'
    ? 'View source'
    : 'View on Genius';

  const metaRows: [string, string][] = [
    ['Artist',   song.artist],
    ['Album',    song.album],
    ['Duration', formatDuration(song.duration)],
    ['Genre',    resolvedGenre],
    ['Language', resolvedLanguage],
    ['Year',     resolvedYear ? String(resolvedYear) : 'Unknown'],
    ['Origin',   originLabel],
    ['Type',     songMeta?.isInstrumental ? 'Instrumental' : 'Vocal'],
  ];

  if (isMetadataLoading) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-slate-50 text-slate-950 dark:bg-[#0c0c0e] dark:text-white"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between px-8 py-4 flex-shrink-0 border-b border-slate-200/10 dark:border-white/10">
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="w-9 h-9 rounded-full" />
                ))}
              </div>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              <div className="flex flex-col items-center justify-center gap-6 px-10 py-8 flex-shrink-0 border-r border-slate-200/70 bg-white/80 dark:bg-[#09090b] dark:border-white/10" style={{ width: 340 }}>
                <Skeleton className="w-52 h-52 rounded-2xl" />
                <div className="text-center w-full space-y-2">
                  <Skeleton className="h-5 w-40 mx-auto" />
                  <Skeleton className="h-4 w-28 mx-auto" />
                </div>
                <Skeleton className="w-14 h-14 rounded-full" />
                <Skeleton className="w-full h-28 rounded-2xl" />
                <Skeleton className="w-full h-16 rounded-xl" />
              </div>

              <div className="flex flex-col gap-4 px-7 py-8 overflow-y-auto flex-shrink-0 border-r border-slate-200/70 dark:border-white/10" style={{ width: 340 }}>
                <Skeleton className="h-3 w-20 mb-1" />
                <div className="rounded-2xl overflow-hidden border border-slate-200/10 dark:border-white/10">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/70 dark:border-white/10 last:border-b-0">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-3 w-20 mt-2" />
                <div className="rounded-2xl p-4 space-y-3 bg-slate-50 border border-slate-200/70 dark:bg-white/5 dark:border-white/10">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-6 w-20 rounded-full" />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col flex-1 min-w-0 px-8 py-8">
                <div className="flex items-baseline justify-between mb-5 flex-shrink-0">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex-1 rounded-2xl p-6 bg-white border border-slate-200/70 shadow-sm dark:bg-white/5 dark:border-white/10 space-y-4">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <Skeleton key={index} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col bg-slate-50 text-slate-950 dark:bg-[#0c0c0e] dark:text-white"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* -- Top bar ----------------------------------------------- */}
          <div
            className="flex items-center justify-between px-8 py-4 flex-shrink-0 border-b border-slate-200/10 dark:border-white/10"
          >
            {/* Song identity */}
            <div className="flex items-center gap-4">
              <img
                src={song.coverUrl}
                alt={song.title}
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.08)` }}
              />
              <div>
                <p className="text-slate-950 dark:text-white font-semibold text-sm leading-tight">{song.title}</p>
                <p className="text-slate-600 dark:text-white/70 text-xs leading-tight mt-0.5">{song.artist}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsLiked(!isLiked)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-white/50"
                style={{
                  background: isLiked ? `${accent}22` : undefined,
                  color: isLiked ? accent : undefined,
                }}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : 'text-slate-500 dark:text-white/50'}`} />
              </button>
              <button className="w-9 h-9 rounded-full flex items-center justify-center transition-colors bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-white/50">
                <Share2 className="w-4 h-4" />
              </button>
              <button className="w-9 h-9 rounded-full flex items-center justify-center transition-colors bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-white/50">
                <Plus className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-slate-300/40 dark:bg-white/10 mx-1" />
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-white/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* -- Body - three columns, no scroll ----------------------- */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Column 1 - Artwork + controls --------------------------- */}
            <div
              className="flex flex-col items-center justify-center gap-6 px-10 py-8 flex-shrink-0 border-r border-slate-200/70 bg-white/80 dark:bg-[#09090b] dark:border-white/10"
              style={{ width: 340 }}
            >
              {/* Artwork */}
              <motion.div
                className="relative"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <img
                  src={song.coverUrl}
                  alt={song.title}
                  className="w-52 h-52 rounded-2xl object-cover"
                  style={{
                    boxShadow: `0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)`,
                  }}
                />
                {/* Colored accent bar under art */}
                <div
                  className="absolute -bottom-1 left-4 right-4 h-1 rounded-full opacity-60"
                  style={{ background: accent }}
                />
              </motion.div>

              {/* Title + Play */}
              <div className="text-center w-full">
                <h1 className="text-slate-950 dark:text-white text-xl font-bold leading-tight truncate">{song.title}</h1>
                <p className="text-slate-600 dark:text-white/70 text-sm mt-1 truncate">{song.artist}</p>
              </div>

              {onPlayPause && (
                <button
                  onClick={onPlayPause}
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                  style={{
                    background: accent,
                    boxShadow: `0 8px 24px ${accent}55`,
                  }}
                >
                  {isPlaying
                    ? <Pause className="w-6 h-6 text-white fill-current" />
                    : <Play className="w-6 h-6 text-white fill-current ml-0.5" />}
                </button>
              )}

              {/* Waveform */}
              <div className="w-full px-2">
                <WaveformVisualizer isPlaying={isPlaying} color={accent} />
              </div>

              {/* Playback status pill */}
              <div className="w-full rounded-xl px-4 py-3 text-xs bg-slate-50/80 border border-slate-200/70 text-slate-700 dark:bg-white/5 dark:border-white/10 dark:text-white/70">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 dark:text-white/40 uppercase tracking-widest text-[10px]">Playback</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      background: completedChecks === playbackChecklist.length ? '#05966922' : '#f59e0b22',
                      color: completedChecks === playbackChecklist.length ? '#34d399' : '#fbbf24',
                    }}
                  >
                    {completedChecks}/{playbackChecklist.length} checks
                  </span>
                </div>
                <p className="text-slate-600 dark:text-white/70">
                  {song.videoId ? 'YouTube audio stream' : 'No source linked'}
                </p>
              </div>
            </div>

            {/* Column 2 - Metadata ----------------------------------- */}
            <div className="flex flex-col gap-4 px-7 py-8 overflow-y-auto flex-shrink-0 border-r border-slate-200/70 dark:border-white/10" style={{ width: 340 }}>
              {/* Song details table */}
              <section>
                <h2 className="text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-white/40 mb-3">Details</h2>
                <div className="rounded-2xl overflow-hidden border border-slate-200/10 dark:border-white/10">
                  {metaRows.map(([label, value], i) => (
                    <div
                      key={label}
                      className={`flex items-center justify-between px-4 py-2.5 text-sm ${i % 2 === 0 ? 'bg-slate-50 dark:bg-white/5' : 'bg-transparent'} ${i < metaRows.length - 1 ? 'border-b border-slate-200/70 dark:border-white/10' : ''}`}
                    >
                      <span className="text-slate-500 dark:text-white/70">{label}</span>
                      <span className="text-slate-950 dark:text-white font-medium truncate ml-4 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Artist bio */}
              <section>
                <h2 className="text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-white/40 mb-3">Artist</h2>
                <div className="rounded-2xl p-4 bg-slate-50 border border-slate-200/70 text-slate-700 dark:bg-white/5 dark:border-white/10 dark:text-white/70">
                  <p className="text-slate-700 dark:text-white/70 text-sm leading-relaxed">
                    {artistMeta?.bio ?? songMeta?.artistBio ?? 'No artist bio available.'}
                  </p>
                  {artistGenres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {artistGenres.map((g) => (
                        <span
                          key={g}
                          className="text-[11px] px-2.5 py-0.5 rounded-full"
                          style={{ background: `${accent}20`, color: accent }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Listening context */}
              {(moodTags.length > 0 || activityTags.length > 0) && (
                <section>
                  <h2 className="text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-white/40 mb-3">Context</h2>
                  <div className="rounded-2xl p-4 space-y-3 bg-slate-50 border border-slate-200/70 text-slate-700 dark:bg-white/5 dark:border-white/10 dark:text-white/70">
                    {moodTags.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/40 mb-2">Mood</p>
                        <div className="flex flex-wrap gap-1.5">
                          {moodTags.map((m) => (
                            <span key={m} className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100/80 text-slate-700 dark:bg-white/10 dark:text-white/70">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {activityTags.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/40 mb-2">Activities</p>
                        <div className="flex flex-wrap gap-1.5">
                          {activityTags.map((a) => (
                            <span key={a} className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100/80 text-slate-700 dark:bg-white/10 dark:text-white/70">
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Genius link */}
              {geniusMetadata?.geniusUrl && (
                <a
                  href={geniusMetadata.geniusUrl ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline underline-offset-2"
                  style={{ color: accent }}
                >
                  {sourceLabel}
                </a>
              )}
            </div>

            {/* Column 3 - Lyrics ------------------------------------ */}
            <div className="flex flex-col flex-1 min-w-0 px-8 py-8">
              <div className="flex items-baseline justify-between mb-5 flex-shrink-0">
                <h2 className="text-slate-950 dark:text-white text-lg font-semibold">Lyrics</h2>
                <span className="text-slate-500 dark:text-white/40 text-xs uppercase tracking-widest">
                  {isLyricsLoading ? 'Loading' : lyricsContent ? 'Available' : 'Unavailable'}
                </span>
              </div>
              {lyricsContent == null && geniusMetadata?.songDescription && (
                <p className="mb-5 text-sm leading-relaxed text-slate-500 dark:text-white/50">
                  {geniusMetadata.songDescription}
                </p>
              )}
              <div
                ref={lyricsRef}
                className="flex-1 overflow-y-auto rounded-2xl p-6 custom-scrollbar bg-white border border-slate-200/70 shadow-sm dark:bg-white/5 dark:border-white/10"
              >
                {lyricsContent ? (
                  <div className="space-y-3">
                    {lyricsContent.split('\n').map((line, idx) => (
                      <p
                        key={idx}
                        className="text-slate-700 dark:text-white/80 text-lg leading-relaxed"
                        style={{ minHeight: '1.5rem' }}
                      >
                        {line || <>&nbsp;</>}
                      </p>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-100 dark:bg-white/10">
                      <Music2 className="w-5 h-5 text-slate-500 dark:text-white/30" />
                    </div>
                    <p className="text-slate-500 dark:text-white/40 text-sm">
                      {isLyricsLoading
                        ? 'Loading lyrics...'
                        : 'No lyrics available for this track.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

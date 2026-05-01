import { useEffect, useState, useRef } from 'react';
import { X, Heart, Share2, Plus, Play, Pause, Clock, Disc, Music2, Calendar, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Song } from '../data/mockData';
import { motion, AnimatePresence } from 'motion/react';
import { WaveformVisualizer } from './WaveformVisualizer';
import { Skeleton } from './ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { getArtistMetadata, getOriginMetadata, getSongMetadata } from '../data/catalogMetadata';
import { fetchSongMetadata, type SongMetadata } from '../lib/metadataApi';
import {
  USER_PLAYLISTS_CHANGE_EVENT,
  addSongToPlaylist,
  createUserPlaylist,
  getPlaylistsContaining,
  listUserPlaylists,
  removeSongFromPlaylist,
  type UserPlaylist,
} from '../lib/userPlaylistStore';
import {
  createPlaybackChecklist,
  getPlaybackEnvironment,
  getYouTubeWatchUrl,
  isValidYouTubeVideoId,
  type PlayerRuntimeDiagnostics,
} from '../lib/playerDiagnostics';

interface SongDetailsPageProps {
  song: Song | null;
  nextSongs: Song[];
  isOpen: boolean;
  onClose: () => void;
  isPlaying: boolean;
  progress: number;
  onPlayPause?: () => void;
  playerRef?: { current: any };
}

const getAccentColor = (songId: string): string => {
  const colors: Record<string, string> = {
    song1: '#7C3AED',
    song2: '#2563EB',
    song3: '#059669',
  };
  return colors[songId] ?? '#D8A35C';
};

export function SongDetailsPage({
  song,
  nextSongs,
  isOpen,
  onClose,
  isPlaying,
  progress,
  onPlayPause,
  playerRef,
}: SongDetailsPageProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [songMetadata, setSongMetadata] = useState<SongMetadata | null>(null);
  const [songLyrics, setSongLyrics] = useState<string | null>(null);
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
  const activeLineRef = useRef<HTMLParagraphElement | null>(null);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');
  const [isPlaylistMenuOpen, setIsPlaylistMenuOpen] = useState(false);
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [containingPlaylistIds, setContainingPlaylistIds] = useState<Set<string>>(new Set());
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const refreshPlaylistState = () => {
    setPlaylists(listUserPlaylists());
    if (song?.id) setContainingPlaylistIds(new Set(getPlaylistsContaining(song.id)));
  };

  useEffect(() => {
    refreshPlaylistState();
    const handler = () => refreshPlaylistState();
    window.addEventListener(USER_PLAYLISTS_CHANGE_EVENT, handler);
    return () => window.removeEventListener(USER_PLAYLISTS_CHANGE_EVENT, handler);
  }, [song?.id]);

  const handleTogglePlaylistMembership = (playlistId: string) => {
    if (!song) return;
    if (containingPlaylistIds.has(playlistId)) {
      removeSongFromPlaylist(playlistId, song.id);
    } else {
      addSongToPlaylist(playlistId, song);
    }
  };

  const handleCreatePlaylistWithSong = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!song) return;
    const name = newPlaylistName.trim() || `${song.title.slice(0, 20)} mix`;
    const playlist = createUserPlaylist(name);
    addSongToPlaylist(playlist.id, song);
    setNewPlaylistName('');
  };

  const inPlaylistCount = containingPlaylistIds.size;

  const handleShareSong = async () => {
    if (!song) return;
    const youtubeUrl = song.videoId
      ? `https://www.youtube.com/watch?v=${song.videoId}`
      : '';
    const shareTitle = `${song.title} — ${song.artist}`;
    const shareText = `🎵 Listening to "${song.title}" by ${song.artist} on Whisky Music`;
    const shareUrl = youtubeUrl || window.location.href;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        setShareState('shared');
        window.setTimeout(() => setShareState('idle'), 1800);
        return;
      } catch (err) {
        // User cancelled or share failed — fall through to clipboard.
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 1800);
    } catch {
      // last resort: select-and-copy fallback
      const ta = document.createElement('textarea');
      ta.value = `${shareText}\n${shareUrl}`;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 1800);
    }
  };

  // Read currentTime directly from the player via rAF — bypasses React state lag.
  const [livePlayerTime, setLivePlayerTime] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    let raf = 0;
    const loop = () => {
      const player = playerRef?.current;
      let now = 0;
      if (player) {
        if (typeof player.getCurrentTime === 'function') {
          try {
            const value = player.getCurrentTime();
            if (typeof value === 'number' && Number.isFinite(value)) now = value;
          } catch {
            // fall back below
          }
        }
        if (now === 0 && typeof player.currentTime === 'number' && Number.isFinite(player.currentTime)) {
          now = player.currentTime;
        }
      }
      if (now === 0 && song?.duration) {
        now = (progress / 100) * song.duration;
      }
      setLivePlayerTime(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isOpen, playerRef, song?.duration, progress]);

  const syncedLinesPrecomputed = (() => {
    const raw = songMetadata?.syncedLyrics;
    if (!raw) return [] as Array<{ time: number; text: string }>;
    const lines: Array<{ time: number; text: string }> = [];
    raw.split(/\r?\n/).forEach((rawLine) => {
      const matches = rawLine.match(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g);
      if (!matches) return;
      const text = rawLine.replace(/\[[^\]]+\]/g, '').trim();
      matches.forEach((stamp) => {
        const m = stamp.match(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/);
        if (!m) return;
        const min = Number(m[1]);
        const sec = Number(m[2]);
        const ms = m[3] ? Number((m[3] + '00').slice(0, 3)) : 0;
        const time = min * 60 + sec + ms / 1000;
        lines.push({ time, text });
      });
    });
    return lines.sort((a, b) => a.time - b.time);
  })();
  const currentTimeSecPre = livePlayerTime;
  const adjustedTimeSecPre = Math.max(0, currentTimeSecPre);
  const activeLineIndex = (() => {
    if (syncedLinesPrecomputed.length === 0) return -1;
    if (adjustedTimeSecPre < syncedLinesPrecomputed[0].time) return -1;
    let idx = 0;
    for (let i = 0; i < syncedLinesPrecomputed.length; i += 1) {
      if (syncedLinesPrecomputed[i].time <= adjustedTimeSecPre) idx = i;
      else break;
    }
    return idx;
  })();

  useEffect(() => {
    if (activeLineIndex < 0) return;
    const node = activeLineRef.current;
    if (!node) return;
    const id = window.setTimeout(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    return () => window.clearTimeout(id);
  }, [activeLineIndex]);

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
      setSongMetadata(null);
      setSongLyrics(null);
      setIsMetadataLoading(false);
      loadingStartedAtRef.current = null;
      return;
    }

    setIsMetadataLoading(true);
    loadingStartedAtRef.current = window.performance.now();
    setSongMetadata(null);
    setSongLyrics(null);

    fetchSongMetadata(song.title, song.artist)
      .then((result) => {
        if (!isMounted) return;
        const metadata = result.data?.metadata ?? null;
        const applyResult = () => {
          if (!isMounted) return;
          setSongMetadata(metadata);
          setSongLyrics(metadata?.songDescription ?? null);
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
  const lyricsContent = songLyrics;
  const isLyricsLoading = isMetadataLoading || (songLyrics === null && songMetadata === null);

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const originLabel = songMeta?.originType === 'movie' || originMeta?.type === 'movie' ? 'Movie' : 'Album';
  const artistGenres = artistMeta?.genres ?? (song.genre ? [song.genre] : []);
  const moodTags = songMeta?.moods ?? [];
  const activityTags = songMeta?.activities ?? [];
  const resolvedGenre =
    songMetadata?.genre || songMeta?.genre || song.genre || 'Unknown';
  const resolvedLanguage = (() => {
    const direct = songMetadata?.language || songMeta?.language || originMeta?.language;
    if (direct) return direct;
    const country = (song.country ?? '').toUpperCase();
    const map: Record<string, string> = {
      USA: 'English', GBR: 'English', AUS: 'English', CAN: 'English',
      IND: 'Hindi / Indian', KOR: 'Korean', JPN: 'Japanese',
      FRA: 'French', DEU: 'German', ITA: 'Italian',
      MEX: 'Spanish', ESP: 'Spanish', ARG: 'Spanish', BRA: 'Portuguese',
      CHN: 'Chinese', RUS: 'Russian', NLD: 'Dutch', SWE: 'Swedish',
    };
    return map[country] || 'Unknown';
  })();
  const resolvedYear = songMetadata?.originYear ?? songMeta?.originYear ?? originMeta?.year ?? song.releaseYear ?? null;
  const resolvedArtistBio =
    artistMeta?.bio ||
    songMeta?.artistBio ||
    songMetadata?.artistDescription ||
    `${song.artist} — ${[resolvedGenre, resolvedLanguage].filter((v) => v && v !== 'Unknown').join(' · ') || 'discover their catalog by playing more tracks.'}`;

  const syncedLines = syncedLinesPrecomputed;
  const hasSyncedLyrics = syncedLines.length > 0;
  const sourceLabel = songMetadata?.source
    ? 'View source'
    : 'View source';

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
            className="fixed inset-0 z-50 flex flex-col bg-background text-foreground"
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
          className="fixed inset-0 z-50 flex flex-col bg-background text-foreground"
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
              <button
                onClick={handleShareSong}
                className="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-white/50 hover:bg-slate-200 dark:hover:bg-white/10"
                title={shareState === 'copied' ? 'Link copied' : 'Share'}
              >
                {shareState === 'copied' || shareState === 'shared' ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                {shareState === 'copied' && (
                  <span className="absolute -bottom-7 right-0 whitespace-nowrap rounded-md bg-slate-950 text-white text-[10px] px-2 py-1 dark:bg-white dark:text-slate-950">
                    Link copied
                  </span>
                )}
              </button>
              <div className="relative">
                <button
                  onClick={() => setIsPlaylistMenuOpen((v) => !v)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    inPlaylistCount > 0
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-white/50 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                  title={inPlaylistCount > 0 ? `In ${inPlaylistCount} playlist${inPlaylistCount === 1 ? '' : 's'}` : 'Add to playlist'}
                >
                  {inPlaylistCount > 0 ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
                {isPlaylistMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-72 z-50 rounded-xl border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-white/10 dark:bg-[#16110a] dark:text-white"
                    onMouseLeave={() => setIsPlaylistMenuOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-slate-200 dark:border-white/10">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 dark:text-white/50">
                        Add "{song.title}" to playlist
                      </p>
                    </div>
                    <div className="max-h-56 overflow-y-auto custom-scrollbar">
                      {playlists.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-slate-500 dark:text-white/50">
                          You have no playlists yet — create one below.
                        </p>
                      ) : (
                        playlists.map((p) => {
                          const inThis = containingPlaylistIds.has(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleTogglePlaylistMembership(p.id)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-white/5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate">{p.name}</p>
                                <p className="text-[10px] text-slate-500 dark:text-white/50">
                                  {p.songIds.length} song{p.songIds.length === 1 ? '' : 's'}
                                </p>
                              </div>
                              {inThis ? (
                                <Check className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <Plus className="h-4 w-4 text-slate-400 dark:text-white/40" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                    <form
                      onSubmit={handleCreatePlaylistWithSong}
                      className="border-t border-slate-200 dark:border-white/10 p-3 flex items-center gap-2"
                    >
                      <input
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        placeholder="New playlist..."
                        className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-950 placeholder:text-slate-400 focus:outline-none focus:border-accent dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40"
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground hover:brightness-110"
                      >
                        Create
                      </button>
                    </form>
                  </div>
                )}
              </div>
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
                  {song.videoId ? 'Playback source linked' : 'No source linked'}
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
                    {resolvedArtistBio}
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

              {songMetadata?.sourceUrl && (
                <a
                  href={songMetadata.sourceUrl ?? undefined}
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
              <div className="flex items-baseline justify-between mb-3 flex-shrink-0">
                <h2 className="text-slate-950 dark:text-white text-lg font-semibold">Lyrics</h2>
                <span className="text-slate-500 dark:text-white/40 text-xs uppercase tracking-widest">
                  {isLyricsLoading ? 'Loading' : lyricsContent ? 'Available' : 'Unavailable'}
                </span>
              </div>
              {nextSongs.length > 0 && (
                <Collapsible defaultOpen={false} className="mb-5 rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm overflow-hidden dark:border-white/10 dark:bg-white/5">
                  <CollapsibleTrigger asChild>
                    <button className="group w-full px-4 py-3 text-left">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-white/40">
                          Next in Queue
                        </p>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/70 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                          <ChevronDown className="h-4 w-4 group-data-[state=open]:hidden" />
                          <ChevronUp className="hidden h-4 w-4 group-data-[state=open]:block" />
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <img
                          src={nextSongs[0].coverUrl}
                          alt={nextSongs[0].title}
                          className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-950 dark:text-white truncate">
                            {nextSongs[0].title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-white/60 truncate">
                            {nextSongs[0].artist}
                          </p>
                        </div>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4 space-y-3">
                    {nextSongs.slice(1, 3).map((queueSong, index) => (
                      <div key={queueSong.id} className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
                        <img
                          src={queueSong.coverUrl}
                          alt={queueSong.title}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-white/40 mb-1">
                            Soon {index + 2}
                          </p>
                          <p className="text-sm font-medium text-slate-950 dark:text-white truncate">
                            {queueSong.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-white/60 truncate">
                            {queueSong.artist}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
              {lyricsContent == null && songMetadata?.songDescription && (
                <p className="mb-5 text-sm leading-relaxed text-slate-500 dark:text-white/50">
                  {songMetadata.songDescription}
                </p>
              )}
              <div
                ref={lyricsRef}
                className="flex-1 overflow-y-auto rounded-2xl p-6 custom-scrollbar bg-white border border-slate-200/70 shadow-sm dark:bg-white/5 dark:border-white/10"
              >
                {hasSyncedLyrics ? (
                  <div className="space-y-3">
                    {syncedLines.map((line, idx) => {
                      const isActive = idx === activeLineIndex;
                      const distance = Math.abs(idx - activeLineIndex);
                      const opacity = isActive ? 1 : Math.max(0.25, 1 - distance * 0.18);
                      return (
                        <p
                          key={`${line.time}-${idx}`}
                          ref={isActive ? activeLineRef : undefined}
                          className={`leading-relaxed transition-all duration-300 ${
                            isActive
                              ? 'text-2xl md:text-3xl font-semibold text-slate-950 dark:text-white'
                              : 'text-base md:text-lg text-slate-500 dark:text-white/60'
                          }`}
                          style={{ opacity, minHeight: '1.5rem' }}
                        >
                          {line.text || <>&nbsp;</>}
                        </p>
                      );
                    })}
                  </div>
                ) : lyricsContent ? (
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

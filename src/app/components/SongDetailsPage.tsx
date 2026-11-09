import { useEffect, useMemo, useState, useRef } from 'react';
import { X, Heart, Share2, Plus, Play, Pause, Clock, Disc, Music2, Calendar, ChevronDown, ChevronUp, Check, CopyX, Crosshair, RotateCcw } from 'lucide-react';
import { Song } from '../data/mockData';
import { motion, AnimatePresence } from 'motion/react';
import { WaveformVisualizer } from './WaveformVisualizer';
import { Skeleton } from './ui/skeleton';
import { Slider } from './ui/slider';
import { WindowControls } from './WindowControls';
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

function resolveShareBaseUrl(): string | null {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (typeof window === 'undefined') return null;
  const isDesktop = Boolean(window.whiskyDesktop);
  const { protocol, hostname, origin } = window.location;
  const isLocalHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(hostname);
  if (!isDesktop && /^https?:$/.test(protocol) && !isLocalHost) return origin;
  return null;
}

function buildSongShareUrl(song: Song): string {
  const base = resolveShareBaseUrl();
  if (base) {
    const shareId = song.videoId || song.id;
    return `${base}/?song=${encodeURIComponent(shareId)}`;
  }
  const youtubeUrl = getYouTubeWatchUrl(song.videoId);
  if (youtubeUrl) return youtubeUrl;
  const query = encodeURIComponent(`${song.title} ${song.artist}`.trim());
  return `https://www.youtube.com/results?search_query=${query}`;
}

interface SongDetailsPageProps {
  song: Song | null;
  nextSongs: Song[];
  isOpen: boolean;
  onClose: () => void;
  isPlaying: boolean;
  progress: number;
  onPlayPause?: () => void;
  onProgressChange?: (progress: number) => void;
  onToggleLike?: (song: Song) => void;
  playbackTime?: number;
  playerRef?: { current: any };
  audioRef?: { current: HTMLAudioElement | null };
}

const getAccentColor = (songId: string): string => {
  const colors: Record<string, string> = {
    song1: '#7C3AED',
    song2: '#2563EB',
    song3: '#059669',
  };
  return colors[songId] ?? '#D8A35C';
};

// Per-song lyric offset (seconds). Positive = lyrics appear later, which is the
// common case when the YouTube video has a longer intro than the studio LRC.
const LYRICS_OFFSET_KEY = 'whisky-lyrics-offsets';
const MAX_LYRICS_OFFSET_S = 30;

function readLyricsOffset(songId: string | undefined): number {
  if (!songId) return 0;
  try {
    const raw = window.localStorage.getItem(LYRICS_OFFSET_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed?.[songId];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeLyricsOffset(songId: string | undefined, value: number) {
  if (!songId) return;
  try {
    const raw = window.localStorage.getItem(LYRICS_OFFSET_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    if (value === 0) delete parsed[songId];
    else parsed[songId] = value;
    window.localStorage.setItem(LYRICS_OFFSET_KEY, JSON.stringify(parsed));
  } catch {
    // Offsets are a convenience — storage failure shouldn't break playback.
  }
}

export function SongDetailsPage({
  song,
  nextSongs,
  isOpen,
  onClose,
  isPlaying,
  progress,
  onPlayPause,
  onProgressChange,
  onToggleLike,
  playbackTime,
  playerRef,
  audioRef,
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
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared' | 'failed'>('idle');
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
    const shareTitle = `${song.title} — ${song.artist}`;
    const shareText = `🎵 Listening to "${song.title}" by ${song.artist} on Whisky Music`;
    const shareUrl = buildSongShareUrl(song);
    const isDesktop = Boolean(window.whiskyDesktop);

    // The desktop app's native share sheet is unreliable; copy straight to the OS
    // clipboard instead (the web build still gets the normal share sheet).
    if (!isDesktop && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        setShareState('shared');
        window.setTimeout(() => setShareState('idle'), 1800);
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    let copied = false;
    const desktopClipboard = window.whiskyDesktop?.clipboard;
    if (desktopClipboard?.writeText) {
      try {
        copied = await desktopClipboard.writeText(shareUrl);
      } catch {
        copied = false;
      }
    }
    if (!copied && typeof navigator.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) {
      // Last resort: an off-screen textarea keeps the URL copyable even when the
      // async Clipboard API is blocked by the renderer's permission policy.
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, shareUrl.length);
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
      document.body.removeChild(ta);
    }

    if (!copied) {
      setShareState('failed');
      window.setTimeout(() => setShareState('idle'), 2400);
      // Give the user a manual way out rather than pretending the copy worked.
      window.prompt('Copy this link', shareUrl);
      return;
    }

    setShareState('copied');
    window.setTimeout(() => setShareState('idle'), 1800);
  };

  const syncedLinesPrecomputed = useMemo(() => {
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
  }, [songMetadata?.syncedLyrics]);

  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const activeLineIndexRef = useRef(-1);
  const [lyricsOffset, setLyricsOffset] = useState(0);
  const playbackTimeRef = useRef(0);

  useEffect(() => {
    setLyricsOffset(readLyricsOffset(song?.id));
  }, [song?.id]);

  const nudgeLyricsOffset = (delta: number) => {
    const next = Math.max(
      -MAX_LYRICS_OFFSET_S,
      Math.min(MAX_LYRICS_OFFSET_S, Math.round((lyricsOffset + delta) * 10) / 10),
    );
    setLyricsOffset(next);
    writeLyricsOffset(song?.id, next);
  };

  // One-tap calibration: the user presses this the moment the first synced line
  // is sung, and we shift every timestamp by the difference. Handles intros and
  // version-length differences without a full editor.
  const calibrateLyricsOffset = () => {
    const first = syncedLinesPrecomputed[0];
    const now = playbackTimeRef.current;
    if (!first || !Number.isFinite(now) || now <= 0) return;
    const next = Math.max(
      -MAX_LYRICS_OFFSET_S,
      Math.min(MAX_LYRICS_OFFSET_S, Math.round((now - first.time) * 10) / 10),
    );
    setLyricsOffset(next);
    writeLyricsOffset(song?.id, next);
  };

  const resetLyricsOffset = () => {
    setLyricsOffset(0);
    writeLyricsOffset(song?.id, 0);
  };

  // Drive the highlighted line straight from the audio element every frame.
  // Reading media.currentTime avoids the ~250ms lag of React state updates.
  useEffect(() => {
    if (!isOpen) return;
    let raf = 0;
    const lines = syncedLinesPrecomputed;

    const readTime = () => {
      const audio = audioRef?.current;
      if (audio && Number.isFinite(audio.currentTime) && audio.currentTime >= 0) return audio.currentTime;
      const player = playerRef?.current;
      if (player) {
        if (typeof player.getCurrentTime === 'function') {
          try {
            const value = player.getCurrentTime();
            if (typeof value === 'number' && Number.isFinite(value)) return value;
          } catch {
            // fall back below
          }
        }
        if (typeof player.currentTime === 'number' && Number.isFinite(player.currentTime)) return player.currentTime;
      }
      if (typeof playbackTime === 'number' && Number.isFinite(playbackTime) && playbackTime > 0) return playbackTime;
      if (song?.duration) return (progress / 100) * song.duration;
      return 0;
    };

    const indexFor = (time: number) => {
      if (lines.length === 0 || time < lines[0].time) return -1;
      let idx = 0;
      for (let i = 0; i < lines.length; i += 1) {
        if (lines[i].time <= time) idx = i;
        else break;
      }
      return idx;
    };

    const loop = () => {
      const now = readTime();
      playbackTimeRef.current = now;
      const idx = indexFor(now - lyricsOffset);
      if (idx !== activeLineIndexRef.current) {
        activeLineIndexRef.current = idx;
        setActiveLineIndex(idx);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isOpen, syncedLinesPrecomputed, audioRef, playerRef, playbackTime, song?.duration, progress, lyricsOffset]);

  useEffect(() => {
    activeLineIndexRef.current = -1;
    setActiveLineIndex(-1);
  }, [song?.id]);

  useEffect(() => {
    if (activeLineIndex < 0) return;
    const node = activeLineRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  const formatDuration = (s: number) => {
    const total = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0));
    return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
  };

  const originLabel = songMeta?.originType === 'movie' || originMeta?.type === 'movie' ? 'Movie' : 'Album';
  const artistGenres = artistMeta?.genres ?? (song.genre ? [song.genre] : []);
  const moodTags = songMeta?.moods ?? [];
  const activityTags = songMeta?.activities ?? [];
  const resolvedGenre =
    songMetadata?.genre || songMeta?.genre || song.genre || 'Unknown';
  const resolvedLanguage = (() => {
    const direct = songMetadata?.language || songMeta?.language || originMeta?.language;
    const genreText = `${songMetadata?.genre ?? ''} ${songMeta?.genre ?? ''} ${song.genre ?? ''}`;
    const scriptSample = `${songMetadata?.songDescription ?? ''} ${songMetadata?.syncedLyrics ?? ''} ${song.title ?? ''}`;
    const hindiSignal =
      /bollywood|hindi|indian|filmi|desi/i.test(genreText) || /[\u0900-\u097F]/.test(scriptSample);
    if (hindiSignal && (!direct || /english|unknown/i.test(direct))) return 'Hindi / Indian';
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
  const playedSeconds =
    typeof playbackTime === 'number' && Number.isFinite(playbackTime) && playbackTime > 0
      ? playbackTime
      : (progress / 100) * (song.duration || 0);
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
            <div className="flex items-center justify-between px-8 py-4 flex-shrink-0 border-b border-slate-200/10 dark:border-border/80">
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
              <div className="flex flex-col items-center justify-center gap-6 px-10 py-8 flex-shrink-0 border-r border-slate-200/70 bg-white/80 dark:bg-background dark:border-border/80" style={{ width: 340 }}>
                <Skeleton className="w-52 h-52 rounded-2xl" />
                <div className="text-center w-full space-y-2">
                  <Skeleton className="h-5 w-40 mx-auto" />
                  <Skeleton className="h-4 w-28 mx-auto" />
                </div>
                <Skeleton className="w-14 h-14 rounded-full" />
                <Skeleton className="w-full h-28 rounded-2xl" />
                <Skeleton className="w-full h-16 rounded-xl" />
              </div>

              <div className="flex flex-col gap-4 px-7 py-8 overflow-y-auto flex-shrink-0 border-r border-slate-200/70 dark:border-border/80" style={{ width: 340 }}>
                <Skeleton className="h-3 w-20 mb-1" />
                <div className="rounded-2xl overflow-hidden border border-slate-200/10 dark:border-border/80">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/70 dark:border-border/80 last:border-b-0">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-3 w-20 mt-2" />
                <div className="rounded-2xl p-4 space-y-3 bg-slate-50 border border-slate-200/70 dark:bg-secondary/45 dark:border-border/80">
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
                <div className="flex-1 rounded-2xl p-6 bg-white border border-slate-200/70 shadow-sm dark:bg-secondary/45 dark:border-border/80 space-y-4">
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
          <div className="app-region-drag flex items-center justify-between pl-8 pr-5 py-4 flex-shrink-0 border-b border-slate-200/10 dark:border-border/80">
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
            <div className="app-region-no-drag flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsLiked(!isLiked);
                  onToggleLike?.(song);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/55 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                style={{
                  background: isLiked ? `${accent}22` : undefined,
                  color: isLiked ? accent : undefined,
                }}
                title={isLiked ? 'Remove from Liked Songs' : 'Like this song'}
                aria-label={isLiked ? 'Remove from Liked Songs' : 'Like this song'}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleShareSong}
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-secondary/55 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title={
                  shareState === 'copied'
                    ? 'Link copied'
                    : shareState === 'failed'
                      ? 'Copy failed'
                      : 'Share'
                }
                aria-label="Share song"
              >
                {shareState === 'copied' || shareState === 'shared' ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : shareState === 'failed' ? (
                  <CopyX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                {(shareState === 'copied' || shareState === 'failed') && (
                  <span className="absolute -bottom-7 right-0 whitespace-nowrap rounded-md bg-slate-950 text-white text-[10px] px-2 py-1 dark:bg-white dark:text-slate-950">
                    {shareState === 'copied' ? 'Link copied' : 'Copy failed'}
                  </span>
                )}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPlaylistMenuOpen((v) => !v)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                    inPlaylistCount > 0
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : 'bg-secondary/55 text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                  title={inPlaylistCount > 0 ? `In ${inPlaylistCount} playlist${inPlaylistCount === 1 ? '' : 's'}` : 'Add to playlist'}
                  aria-label="Add to playlist"
                >
                  {inPlaylistCount > 0 ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
                {isPlaylistMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-72 z-50 rounded-xl border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-border/80 dark:bg-popover dark:text-white"
                    onMouseLeave={() => setIsPlaylistMenuOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-slate-200 dark:border-border/80">
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
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-card/50"
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
                      className="border-t border-slate-200 dark:border-border/80 p-3 flex items-center gap-2"
                    >
                      <input
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        placeholder="New playlist..."
                        className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-950 placeholder:text-slate-400 focus:outline-none focus:border-accent dark:border-border/80 dark:bg-secondary/45 dark:text-white dark:placeholder:text-white/40"
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
              <div className="mx-1 h-6 w-px bg-border/70" />
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/55 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title="Close song details"
                aria-label="Close song details"
              >
                <X className="w-4 h-4" />
              </button>
              <WindowControls />
            </div>
          </div>

          {/* -- Body - three columns, no scroll ----------------------- */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Column 1 - Artwork + controls --------------------------- */}
            <div
              className="flex flex-col items-center justify-center gap-6 px-10 py-8 flex-shrink-0 border-r border-slate-200/70 bg-white/80 dark:bg-background dark:border-border/80"
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
              <div className="w-full rounded-xl px-4 py-3 text-xs bg-slate-50/80 border border-slate-200/70 text-slate-700 dark:bg-secondary/45 dark:border-border/80 dark:text-white/70">
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
            <div className="flex flex-col gap-4 px-7 py-8 overflow-y-auto flex-shrink-0 border-r border-slate-200/70 dark:border-border/80" style={{ width: 340 }}>
              {/* Song details table */}
              <section>
                <h2 className="text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-white/40 mb-3">Details</h2>
                <div className="rounded-2xl overflow-hidden border border-slate-200/10 dark:border-border/80">
                  {metaRows.map(([label, value], i) => (
                    <div
                      key={label}
                      className={`flex items-center justify-between px-4 py-2.5 text-sm ${i % 2 === 0 ? 'bg-slate-50 dark:bg-secondary/45' : 'bg-transparent'} ${i < metaRows.length - 1 ? 'border-b border-slate-200/70 dark:border-border/80' : ''}`}
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
                <div className="rounded-2xl p-4 bg-slate-50 border border-slate-200/70 text-slate-700 dark:bg-secondary/45 dark:border-border/80 dark:text-white/70">
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
                  <div className="rounded-2xl p-4 space-y-3 bg-slate-50 border border-slate-200/70 text-slate-700 dark:bg-secondary/45 dark:border-border/80 dark:text-white/70">
                    {moodTags.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/40 mb-2">Mood</p>
                        <div className="flex flex-wrap gap-1.5">
                          {moodTags.map((m) => (
                            <span key={m} className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100/80 text-slate-700 dark:bg-secondary/60 dark:text-white/70">
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
                            <span key={a} className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100/80 text-slate-700 dark:bg-secondary/60 dark:text-white/70">
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

              {/* Playback slider */}
              <section className="mt-6 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 dark:border-border/80 dark:bg-secondary/45">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-white/40">
                    Playback
                  </h2>
                  <span className="text-[11px] tabular-nums text-slate-600 dark:text-white/60">
                    {formatDuration(playedSeconds)} / {formatDuration(song.duration || 0)}
                  </span>
                </div>
                <Slider
                  value={[Math.max(0, Math.min(100, progress))]}
                  onValueChange={(value) => onProgressChange?.(value[0])}
                  max={100}
                  step={0.1}
                  className="w-full"
                />
              </section>
            </div>

            {/* Column 3 - Lyrics ------------------------------------ */}
            <div className="flex flex-col flex-1 min-w-0 px-8 py-8">
              <div className="flex items-baseline justify-between mb-3 flex-shrink-0">
                <h2 className="text-slate-950 dark:text-white text-lg font-semibold">Lyrics</h2>
                <span className="text-slate-500 dark:text-white/40 text-xs uppercase tracking-widest">
                  {isLyricsLoading ? 'Loading' : lyricsContent ? 'Available' : 'Unavailable'}
                </span>
              </div>
              {hasSyncedLyrics && (
                <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-2 text-xs shadow-sm dark:border-border/80 dark:bg-secondary/45">
                  <span className="mr-1 text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-white/40">
                    Sync
                  </span>
                  {[
                    { label: '-0.5s', delta: -0.5 },
                    { label: '-0.1s', delta: -0.1 },
                  ].map(({ label, delta }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => nudgeLyricsOffset(delta)}
                      className="rounded-full border border-slate-200/70 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-border/80 dark:bg-secondary/45 dark:text-white/70 dark:hover:bg-secondary/65"
                    >
                      {label}
                    </button>
                  ))}
                  <span className="min-w-[3.25rem] text-center text-[11px] font-semibold tabular-nums text-slate-700 dark:text-white/80">
                    {lyricsOffset > 0 ? '+' : ''}
                    {lyricsOffset.toFixed(1)}s
                  </span>
                  {[
                    { label: '+0.1s', delta: 0.1 },
                    { label: '+0.5s', delta: 0.5 },
                  ].map(({ label, delta }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => nudgeLyricsOffset(delta)}
                      className="rounded-full border border-slate-200/70 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-border/80 dark:bg-secondary/45 dark:text-white/70 dark:hover:bg-secondary/65"
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={calibrateLyricsOffset}
                    title="Press when you hear the first lyric line start"
                    className="ml-1 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/20"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    Sync now
                  </button>
                  {lyricsOffset !== 0 && (
                    <button
                      type="button"
                      onClick={resetLyricsOffset}
                      title="Reset sync offset"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:border-border/80 dark:bg-secondary/45 dark:text-white/60 dark:hover:bg-secondary/65"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  )}
                </div>
              )}
              {nextSongs.length > 0 && (
                <Collapsible defaultOpen={false} className="mb-5 rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm overflow-hidden dark:border-border/80 dark:bg-secondary/45">
                  <CollapsibleTrigger asChild>
                    <button className="group w-full px-4 py-3 text-left">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-white/40">
                          Next in Queue
                        </p>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/70 bg-white text-slate-700 dark:border-border/80 dark:bg-secondary/45 dark:text-white/70">
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
                      <div key={queueSong.id} className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-border/80 dark:bg-secondary/45">
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
                className="flex-1 overflow-y-auto rounded-2xl p-6 custom-scrollbar bg-white border border-slate-200/70 shadow-sm dark:bg-secondary/45 dark:border-border/80"
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
                          className={`leading-relaxed ${
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
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-100 dark:bg-secondary/60">
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

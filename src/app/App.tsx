import { useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { TopNavigation, type ContentLanguage } from './components/TopNavigation';
import { SongCard } from './components/SongCard';
import { PlaylistCard } from './components/PlaylistCard';
import MusicPlayer from './components/MusicPlayer';
import ReactPlayer from 'react-player';
import { MoodView } from './components/MoodView';
import { MultiUserSession } from './components/MultiUserSession';
import { AIAssistant } from './components/AIAssistant';
import { SongDetailsPage } from './components/SongDetailsPage';
import { CustomCursor } from './components/CustomCursor';
import { LoginPage } from './components/LoginPage';
import { OnboardingModal, type OnboardingPreferences } from './components/OnboardingModal';
import { WidgetManagerPage } from './components/widgets/WidgetManagerPage';
import { WIDGET_REGISTRY } from './components/widgets/widgetRegistry';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { Skeleton } from './components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { Sparkles, Users } from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import { supabase, supabaseConfigError } from './lib/supabaseClient';
import { logRecommendationEvent, requestPasswordResetEmail, sendWelcomeEmail } from './lib/resendApi';
import { searchSongsOnline } from './lib/songSearchApi';
import { useOfflineStatus } from './lib/useOfflineStatus';
import { buildSeedQueries, buildUserProfile, rankAndDiversify } from './lib/recommendationEngine';
import { isValidYouTubeVideoId } from './lib/playerDiagnostics';
import { getArtistMetadata, getSongMetadata } from './data/catalogMetadata';
import {
  Song,
  mockSongs,
  mockPlaylists,
} from './data/mockData';

function getDisplayNameFromUser(user: User | null): string {
  if (!user) return 'Listener';
  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim();
  const localPart = user.email?.split('@')[0]?.trim();
  if (localPart) return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  return 'Listener';
}

function isPasswordRecoveryRequest(): boolean {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return searchParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
}

function clearRecoveryParamsFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('type');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

const STORAGE_KEYS = {
  activeMenuItem: 'whisky-active-menu-item',
  likedSongIds: 'whisky-liked-song-ids',
  onboardingPrefs: 'whisky-onboarding-prefs',
  activeWidgets: 'whisky-active-widgets',
  contentLanguage: 'whisky-content-language',
  volume: 'whisky-volume',
} as const;

function getStoredVolume(): number {
  const raw = window.localStorage.getItem(STORAGE_KEYS.volume);
  if (raw === null) return 70;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 70;
  return Math.max(0, Math.min(100, parsed));
}

function getStoredContentLanguage(): ContentLanguage {
  const value = window.localStorage.getItem(STORAGE_KEYS.contentLanguage);
  return value === 'Hindi' ? 'Hindi' : 'English';
}

function getStoredActiveWidgets(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.activeWidgets);
    if (!raw) return ['now-playing', 'recent-plays'];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === 'string');
  } catch {
    return [];
  }
}

function getStoredOnboardingPrefs(): OnboardingPreferences | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.onboardingPrefs);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as OnboardingPreferences;
  } catch {
    return null;
  }
}

const VALID_MENU_ITEMS = new Set([
  'home', 'search', 'library', 'playlists', 'ai-dj', 'mood', 'multiuser',
]);

function getStoredActiveMenuItem(): string {
  const value = window.localStorage.getItem(STORAGE_KEYS.activeMenuItem);
  const normalized = value === 'liked' ? 'library' : value;
  return normalized && VALID_MENU_ITEMS.has(normalized) ? normalized : 'home';
}

function getStoredLibraryTab(): 'played' | 'liked' {
  const value = window.localStorage.getItem(STORAGE_KEYS.activeMenuItem);
  return value === 'liked' ? 'liked' : 'played';
}

function getStoredLikedSongIds(): Set<string> {
  const raw = window.localStorage.getItem(STORAGE_KEYS.likedSongIds);
  if (!raw) return new Set<string>();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((id) => typeof id === 'string'));
  } catch {
    return new Set<string>();
  }
}

function getStoredRecentSongs(): Song[] {
  const raw = window.localStorage.getItem('whisky-recent-songs');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) =>
        entry && typeof entry === 'object' && typeof entry.id === 'string' && typeof entry.title === 'string',
    ) as Song[];
  } catch {
    return [];
  }
}

const RECENT_SONGS_LIMIT = 60;

function pushRecentSong(list: Song[], song: Song): Song[] {
  const filtered = list.filter((entry) => entry.id !== song.id);
  return [song, ...filtered].slice(0, RECENT_SONGS_LIMIT);
}

function AppContent() {
  const isOffline = useOfflineStatus();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(isPasswordRecoveryRequest);
  const [authNotice, setAuthNotice] = useState('');
  const [displayName, setDisplayName] = useState('Listener');
  const [activeMenuItem, setActiveMenuItem] = useState(getStoredActiveMenuItem);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [, setCurrentTime] = useState(0);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState<number>(getStoredVolume);
  // Direct audio URL extracted server-side via yt-dlp. When present, we use a plain
  // HTML5 <audio> element instead of the YouTube IFrame embed — this bypasses every
  // embed restriction (error 150) since we're streaming the raw audio directly.
  const [directAudioUrl, setDirectAudioUrl] = useState<string | null>(null);
  // Track whether we're still waiting on yt-dlp before mounting the iframe fallback —
  // prevents the iframe from spamming error 150 in the few seconds before audio
  // extraction returns. Only mount the iframe if yt-dlp explicitly gives up.
  const [audioStreamResolved, setAudioStreamResolved] = useState(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.volume, String(volume));
  }, [volume]);
  const [repeatMode, setRepeatMode] = useState<'off' | 'one' | 'all'>('off');
  const [searchQuery, setSearchQuery] = useState('');
  const [libraryTab, setLibraryTab] = useState<'played' | 'liked'>(getStoredLibraryTab);
  const [likedSongIds, setLikedSongIds] = useState<Set<string>>(getStoredLikedSongIds);
  const [recentlyPlayedSongs, setRecentlyPlayedSongs] = useState<Song[]>(getStoredRecentSongs);
  const recentlyPlayedIds = useMemo(() => recentlyPlayedSongs.map((song) => song.id), [recentlyPlayedSongs]);
  const [aiRecommendedSongs, setAiRecommendedSongs] = useState<Song[]>([]);
  const [aiRecommendationError, setAiRecommendationError] = useState('');
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);
  const [aiRerankedSongIds, setAiRerankedSongIds] = useState<string[]>([]);
  const [onlineSearchSongs, setOnlineSearchSongs] = useState<Song[]>([]);
  const [isOnlineSearchLoading, setIsOnlineSearchLoading] = useState(false);
  const [onlineSearchError, setOnlineSearchError] = useState('');
  const [playbackNotice, setPlaybackNotice] = useState('');
  const [onboardingPrefs, setOnboardingPrefs] = useState<OnboardingPreferences | null>(getStoredOnboardingPrefs);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>(getStoredContentLanguage);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.contentLanguage, contentLanguage);
  }, [contentLanguage]);

  const effectiveLanguages = useMemo<string[]>(() => {
    const others = (onboardingPrefs?.languages ?? []).filter((lang) => lang !== contentLanguage);
    return [contentLanguage, ...others];
  }, [contentLanguage, onboardingPrefs?.languages]);

  const [activeWidgetIds, setActiveWidgetIds] = useState<string[]>(getStoredActiveWidgets);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.activeWidgets, JSON.stringify(activeWidgetIds));
  }, [activeWidgetIds]);

  const handleToggleWidgetWithRedirect = (id: string) => {
    setActiveWidgetIds((prev) => {
      const isAdding = !prev.includes(id);
      const next = isAdding ? [...prev, id] : prev.filter((entry) => entry !== id);
      if (!isAdding && activeMenuItem === id) setActiveMenuItem('home');
      return next;
    });
  };

  const handleSelectMoodFromWidget = (moodId: string) => {
    setActiveMenuItem('mood');
    window.localStorage.setItem('whisky-mood-preselect', moodId);
  };
  const playerRef = useRef<any>(null);
  const repeatOneUsedRef = useRef(false);
  const songEndFiredRef = useRef<string | null>(null);
  // Track videoIds we've already tried (and that errored) for the current song so we
  // can ask the server for alternates instead of reusing the same broken ID.
  const triedVideoIdsRef = useRef<Map<string, Set<string>>>(new Map());
  const altLookupInFlightRef = useRef<string | null>(null);
  // For YouTube embed API, always set origin for best compatibility
  const youtubeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  // NOTE: For maximum compatibility, ReactPlayer is always mounted, never display:none, and playback is user-triggered on mobile due to browser autoplay policies.

  const applyLikedState = (songs: Song[]): Song[] =>
    songs.map((song) => ({ ...song, isLiked: likedSongIds.has(song.id) }));

  const uniqueSongsById = (songs: Song[]) => Array.from(new Map(songs.map((song) => [song.id, song] as const)).values());

  const allSongs = useMemo(() => applyLikedState(mockSongs), [likedSongIds]);
  const recommendedSongsView = useMemo(() => uniqueSongsById(aiRecommendedSongs), [aiRecommendedSongs]);
  const playedSongsView = useMemo(
    () => recentlyPlayedSongs.map((song) => ({ ...song, isLiked: likedSongIds.has(song.id) })),
    [recentlyPlayedSongs, likedSongIds],
  );
  const lastSessionSongsView = useMemo(() => playedSongsView.slice(0, 6), [playedSongsView]);

  const candidatePool = useMemo(
    () => uniqueSongsById([...allSongs, ...aiRecommendedSongs, ...onlineSearchSongs]),
    [allSongs, aiRecommendedSongs, onlineSearchSongs],
  );

  const songDirectoryRef = useRef<Map<string, Song>>(new Map());
  useEffect(() => {
    candidatePool.forEach((song) => songDirectoryRef.current.set(song.id, song));
    if (currentSong) songDirectoryRef.current.set(currentSong.id, currentSong);
  }, [candidatePool, currentSong]);

  useEffect(() => {
    repeatOneUsedRef.current = false;
  }, [currentSong?.id]);

  const pickSmartNextSong = (current: Song | null): Song | null => {
    if (!current) return null;

    const currentSongMeta = getSongMetadata(current.id);
    const currentArtistMeta = getArtistMetadata(current.artist);
    const candidates = candidatePool.filter((song) => song.id !== current.id && isValidYouTubeVideoId(song.videoId));
    const currentLanguage = currentSongMeta?.language;
    const currentGenre = currentSongMeta?.genre;
    const currentArtist = current.artist;
    const sameLanguageCandidates = currentLanguage
      ? candidates.filter((song) => getSongMetadata(song.id)?.language === currentLanguage)
      : [];
    const sameArtistOrGenreCandidates = candidates.filter((song) => {
      const songMeta = getSongMetadata(song.id);
      return Boolean(
        (currentArtist && song.artist === currentArtist)
          || (currentGenre && songMeta?.genre === currentGenre)
          || (currentLanguage && songMeta?.language === currentLanguage)
      );
    });
    const narrowedCandidates = sameLanguageCandidates.length > 0
      ? sameLanguageCandidates
      : sameArtistOrGenreCandidates.length > 0
        ? sameArtistOrGenreCandidates
        : candidates;

    if (narrowedCandidates.length === 0) return null;

    const scored = narrowedCandidates
      .map((song) => {
        const songMeta = getSongMetadata(song.id);
        const artistMeta = getArtistMetadata(song.artist);

        let score = 0;
        if (song.artist === current.artist) score += 100;
        if (songMeta?.originTitle && currentSongMeta?.originTitle && songMeta.originTitle === currentSongMeta.originTitle) score += 50;
        if (songMeta?.genre && currentSongMeta?.genre && songMeta.genre === currentSongMeta.genre) score += 40;
        if (songMeta?.language && currentSongMeta?.language && songMeta.language === currentSongMeta.language) score += 20;
        if (songMeta?.isInstrumental === currentSongMeta?.isInstrumental) score += 10;
        if (songMeta?.energy === currentSongMeta?.energy) score += 8;

        const moodOverlap = songMeta?.moods?.filter((mood) => currentSongMeta?.moods?.includes(mood)).length ?? 0;
        const activityOverlap = songMeta?.activities?.filter((activity) => currentSongMeta?.activities?.includes(activity)).length ?? 0;
        const artistGenreOverlap = artistMeta?.genres?.filter((genre) => currentArtistMeta?.genres?.includes(genre)).length ?? 0;

        score += moodOverlap * 5;
        score += activityOverlap * 3;
        score += artistGenreOverlap * 2;

        return { song, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored[0]?.score > 0 ? scored[0].song : narrowedCandidates[0];
  };

  const queuePreviewSongs = useMemo(() => {
    const queue: Song[] = [];
    let cursor = currentSong;

    for (let i = 0; i < 3; i += 1) {
      const nextSong = cursor ? pickSmartNextSong(cursor) : null;
      if (!nextSong) break;
      queue.push(nextSong);
      cursor = nextSong;
    }

    return queue;
  }, [currentSong, candidatePool]);

  const handlePlaySong = async (song: Song) => {
    const playableSong = await resolvePlayableSong(song);
    if (!playableSong) {
      setIsPlaying(false);
      return;
    }
    setPlaybackNotice('');
    setCurrentSong(playableSong);
    setIsPlaying(true);
    setProgress(0);
    setCurrentTime(0);
    const index = candidatePool.findIndex((s) => s.id === playableSong.id);
    setCurrentSongIndex(index !== -1 ? index : -1);
    repeatOneUsedRef.current = false;
    setRecentlyPlayedSongs((prev) => pushRecentSong(prev, playableSong));
    void logRecommendationEvent({
      eventType: 'play',
      songId: playableSong.id,
      likedSongIds: [...likedSongIds],
      recentlyPlayedIds: [playableSong.id, ...recentlyPlayedIds.filter((id) => id !== playableSong.id)].slice(0, 6),
      currentSongId: playableSong.id,
    });
  };

  const handlePlayPause = () => {
    if (currentSong && (!currentSong.videoId || !isValidYouTubeVideoId(currentSong.videoId))) {
      setPlaybackNotice(
        `"${currentSong.title}" cannot be played because it does not have a valid YouTube videoId.`,
      );
      setIsPlaying(false);
      return;
    }
    setPlaybackNotice('');
    setIsPlaying(!isPlaying);
  };

  const handleNext = async () => {
    const fallback = candidatePool[(currentSongIndex + 1) % Math.max(candidatePool.length, 1)] ?? null;
    let nextSong: Song | null = pickSmartNextSong(currentSong) ?? fallback ?? null;

    if (!nextSong && currentSong?.artist) {
      const result = await searchSongsOnline(currentSong.artist, 6, currentSong.country?.toLowerCase().slice(0, 2) ?? '');
      const candidates = (result.data ?? []).filter(
        (song) => song.id !== currentSong.id && song.videoId && song.videoId.length === 11,
      );
      if (candidates.length > 0) {
        nextSong = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }

    if (!nextSong) return;

    const playableSong = await resolvePlayableSong(nextSong);
    if (!playableSong) {
      setIsPlaying(false);
      return;
    }

    const nextIndex = candidatePool.findIndex((song) => song.id === playableSong.id);
    setCurrentSongIndex(nextIndex !== -1 ? nextIndex : -1);
    setCurrentSong(playableSong);
    setIsPlaying(true);
    setProgress(0);
    setCurrentTime(0);
    setPlaybackNotice('');
    repeatOneUsedRef.current = false;
    setRecentlyPlayedSongs((prev) => pushRecentSong(prev, playableSong));
  };

  // For ReactPlayer onEnd
  const playNext = () => {
    if (!currentSong) return;

    if (repeatMode === 'one' && !repeatOneUsedRef.current) {
      repeatOneUsedRef.current = true;
      setIsPlaying(true);
      setProgress(0);
      setCurrentTime(0);
      const player = playerRef.current;
      if (player?.seekTo) {
        player.seekTo(0, 'seconds');
      } else if (typeof player?.currentTime === 'number') {
        player.currentTime = 0;
      }
      return;
    }

    if (repeatMode === 'all') {
      setIsPlaying(true);
      setProgress(0);
      setCurrentTime(0);
      setPlaybackNotice('');
      const player = playerRef.current;
      if (player?.seekTo) {
        player.seekTo(0, 'seconds');
      } else if (typeof player?.currentTime === 'number') {
        player.currentTime = 0;
      }
      return;
    }

    handleNext();
  };

  const handleRepeatModeChange = () => {
    setRepeatMode((prev) => (prev === 'off' ? 'one' : prev === 'one' ? 'all' : 'off'));
    repeatOneUsedRef.current = false;
  };

  const handlePlayerProgress = (seconds: number) => {
    setCurrentTime(seconds);
    if (currentSong?.duration) {
      setProgress(Math.min(100, (seconds / currentSong.duration) * 100));
      if (
        currentSong.duration > 0 &&
        seconds >= currentSong.duration - 0.4 &&
        songEndFiredRef.current !== currentSong.id
      ) {
        songEndFiredRef.current = currentSong.id;
        playNext();
      }
    } else {
      setProgress(0);
    }
  };

  const handleReactPlayerTimeUpdate = (event: SyntheticEvent<HTMLVideoElement>) => {
    handlePlayerProgress(event.currentTarget.currentTime);
  };

  const handleProgressChange = (newProgress: number) => {
    setProgress(newProgress);

    if (!currentSong?.duration) {
      setCurrentTime(0);
      return;
    }

    const nextTime = (newProgress / 100) * currentSong.duration;
    setCurrentTime(nextTime);

    // Seek the active player. When yt-dlp gave us a direct audio URL the HTML5
    // <audio> element is what's playing, so prefer that. Otherwise fall through
    // to the YouTube iframe via ReactPlayer.
    const audioEl = audioElRef.current;
    if (directAudioUrl && audioEl && Number.isFinite(audioEl.duration)) {
      audioEl.currentTime = nextTime;
      return;
    }
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(nextTime, 'seconds');
    } else if (playerRef.current && typeof playerRef.current.currentTime === 'number') {
      playerRef.current.currentTime = nextTime;
    }
  };

  const handlePrevious = () => {
    if (recentlyPlayedSongs.length > 1) {
      const previousSong = recentlyPlayedSongs[1];
      void (async () => {
        const playableSong = await resolvePlayableSong(previousSong);
        if (!playableSong) {
          setIsPlaying(false);
          return;
        }
        const idx = candidatePool.findIndex((song) => song.id === playableSong.id);
        setCurrentSongIndex(idx);
        setCurrentSong(playableSong);
        setIsPlaying(true);
        setProgress(0);
        setCurrentTime(0);
        setPlaybackNotice('');
        repeatOneUsedRef.current = false;
        setRecentlyPlayedSongs((prev) => pushRecentSong(prev, playableSong));
      })();
      return;
    }
    const pool = candidatePool;
    if (pool.length === 0) return;
    const prevIndex = currentSongIndex <= 0 ? pool.length - 1 : currentSongIndex - 1;
    void (async () => {
      const playableSong = await resolvePlayableSong(pool[prevIndex]);
      if (!playableSong) {
        setIsPlaying(false);
        return;
      }
      const idx = candidatePool.findIndex((song) => song.id === playableSong.id);
      setCurrentSongIndex(idx);
      setCurrentSong(playableSong);
      setIsPlaying(true);
      setProgress(0);
      setCurrentTime(0);
      setPlaybackNotice('');
      repeatOneUsedRef.current = false;
    })();
  };

  const handleLikeSong = (songId: string) => {
    const nextLikedSet = new Set(likedSongIds);
    nextLikedSet.has(songId) ? nextLikedSet.delete(songId) : nextLikedSet.add(songId);
    const nextLikedIds = [...nextLikedSet];
    setLikedSongIds(nextLikedSet);
    setCurrentSong((previous) => {
      if (!previous || previous.id !== songId) return previous;
      return { ...previous, isLiked: !previous.isLiked };
    });
    void logRecommendationEvent({
      eventType: 'like',
      songId,
      likedSongIds: nextLikedIds.length > 0 ? nextLikedIds : [...likedSongIds],
      recentlyPlayedIds,
      currentSongId: currentSong?.id ?? null,
    });
  };

  const likedSongsView = allSongs.filter((song) => song.isLiked);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filterSongs = (songs: Song[]) => {
    if (!normalizedSearch) return songs;
    return songs.filter((song) =>
      `${song.title} ${song.artist} ${song.album}`.toLowerCase().includes(normalizedSearch),
    );
  };

  const filterPlaylists = (playlists: typeof mockPlaylists) => {
    if (!normalizedSearch) return playlists;
    return playlists.filter((playlist) =>
      `${playlist.name} ${playlist.description}`.toLowerCase().includes(normalizedSearch),
    );
  };

  const filteredRecentlyPlayed = filterSongs(lastSessionSongsView);
  const filteredLikedSongs = filterSongs(likedSongsView);
  const filteredAllSongs = filterSongs(allSongs);
  const filteredAllPlaylists = filterPlaylists(mockPlaylists);

  const mergedSearchSongs = useMemo(() => {
    if (!normalizedSearch) return filteredAllSongs;
    const seen = new Set(
      filteredAllSongs.map((song) => `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`),
    );
    const external = onlineSearchSongs.filter((song) => {
      const key = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return uniqueSongsById([...filteredAllSongs, ...external]);
  }, [filteredAllSongs, onlineSearchSongs, normalizedSearch]);

  const searchSongsForView = useMemo(() => {
    if (aiRerankedSongIds.length === 0) return mergedSearchSongs;
    const map = new Map(mergedSearchSongs.map((song) => [song.id, song]));
    const ranked: Song[] = [];
    aiRerankedSongIds.forEach((songId) => {
      const match = map.get(songId);
      if (match) {
        ranked.push(match);
        map.delete(songId);
      }
    });
    return Array.from(new Map([...ranked, ...Array.from(map.values())].map((song) => [song.id, song] as const)).values());
  }, [aiRerankedSongIds, mergedSearchSongs]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 25 } },
  };

  useEffect(() => {
    if (!supabase) {
      setIsAuthenticated(false);
      setIsAuthLoading(false);
      return;
    }
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const user = data.session?.user ?? null;
      setIsAuthenticated(Boolean(user));
      setDisplayName(getDisplayNameFromUser(user));
      setIsAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecoveryMode(true);
      const user = session?.user ?? null;
      setIsAuthenticated(Boolean(user));
      setDisplayName(getDisplayNameFromUser(user));
      setIsAuthLoading(false);
    });
    return () => { isMounted = false; data.subscription.unsubscribe(); };
  }, []);



  useEffect(() => { setAiRerankedSongIds([]); }, [searchQuery]);

  useEffect(() => {
    if (!normalizedSearch) {
      setOnlineSearchSongs([]);
      setOnlineSearchError('');
      setIsOnlineSearchLoading(false);
      return;
    }
    // Skip very short queries — 1 char hits the API for almost-random matches and
    // wastes rate limit. Two chars is the minimum useful query.
    if (normalizedSearch.length < 2) {
      setOnlineSearchSongs([]);
      setIsOnlineSearchLoading(false);
      return;
    }
    let isMounted = true;
    setIsOnlineSearchLoading(true);
    setOnlineSearchError('');
    // 350ms debounce — long enough to skip the typist's "th-en-th-t-the" mid-word
    // misfires, short enough that the dropdown still feels live. The cleanup below
    // also cancels any pending timeout when the query changes again, so only the
    // latest keystroke ever triggers a request.
    const timeoutHandle = setTimeout(() => {
      searchSongsOnline(searchQuery, 12).then((result) => {
        if (!isMounted) return;
        if (result.error) {
          setOnlineSearchSongs([]);
          setOnlineSearchError(result.error);
          setIsOnlineSearchLoading(false);
          return;
        }
        setOnlineSearchSongs(result.data ?? []);
        setOnlineSearchError('');
        setIsOnlineSearchLoading(false);
      });
    }, 350);
    return () => { isMounted = false; clearTimeout(timeoutHandle); };
  }, [normalizedSearch, searchQuery]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.activeMenuItem, activeMenuItem);
  }, [activeMenuItem]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim().length > 0 && activeMenuItem !== 'search') {
      setActiveMenuItem('search');
    } else if (value.trim().length === 0 && activeMenuItem === 'search') {
      setActiveMenuItem('home');
    }
  };

  useEffect(() => {
    if (!isAuthenticated || isAuthLoading || isPasswordRecoveryMode) return;
    if (!onboardingPrefs) {
      setIsOnboardingOpen(true);
    }
  }, [isAuthenticated, isAuthLoading, isPasswordRecoveryMode, onboardingPrefs]);

  const handleOnboardingComplete = (prefs: OnboardingPreferences) => {
    window.localStorage.setItem(STORAGE_KEYS.onboardingPrefs, JSON.stringify(prefs));
    setOnboardingPrefs(prefs);
    setIsOnboardingOpen(false);
  };

  const handleOnboardingSkip = () => {
    const defaults: OnboardingPreferences = {
      languages: ['English'],
      genres: ['Pop', 'Hip-Hop', 'Indie'],
      moods: ['Happy', 'Chill'],
      energy: 'medium',
      completedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEYS.onboardingPrefs, JSON.stringify(defaults));
    setOnboardingPrefs(defaults);
    setIsOnboardingOpen(false);
  };

  const handleMenuChange = (item: string) => {
    if (item !== 'search' && searchQuery.trim().length > 0) {
      setSearchQuery('');
    }
    setActiveMenuItem(item);
  };

  const resolvePlayableSong = async (song: Song): Promise<Song | null> => {
    // The pre-flight embed check is no longer needed: yt-dlp extracts a direct audio
    // URL for any videoId regardless of whether YouTube embed is allowed. We just
    // verify the videoId looks well-formed and let the audio-stream effect handle
    // the actual playback resolution.
    if (!song.videoId || !isValidYouTubeVideoId(song.videoId)) {
      setPlaybackNotice(
        `"${song.title}" does not include a valid YouTube videoId yet, so playback is unavailable for this track.`,
      );
      return null;
    }
    return song;
  };

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.likedSongIds, JSON.stringify([...likedSongIds]));
  }, [likedSongIds]);

  useEffect(() => {
    window.localStorage.setItem('whisky-recent-songs', JSON.stringify(recentlyPlayedSongs));
  }, [recentlyPlayedSongs]);

  // When the current song or its videoId changes, ask the server to extract a direct
  // audio URL via yt-dlp. If we get one, the renderer plays via plain <audio> (no
  // YouTube embed restrictions). If extraction fails, we fall back to the iframe.
  useEffect(() => {
    if (!currentSong?.videoId) {
      setDirectAudioUrl(null);
      setAudioStreamResolved(false);
      return;
    }
    let cancelled = false;
    setDirectAudioUrl(null);
    setAudioStreamResolved(false);
    const targetVid = currentSong.videoId;
    fetch(`/api/audio-stream?videoId=${encodeURIComponent(targetVid)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { url?: string } | null) => {
        if (cancelled) return;
        if (data?.url) setDirectAudioUrl(data.url);
        // Mark resolved either way — if no URL came back, the iframe fallback
        // is now allowed to mount and try its own thing.
        setAudioStreamResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setAudioStreamResolved(true);
      });
    return () => { cancelled = true; };
  }, [currentSong?.videoId]);

  // Drive the audio element's play/pause + volume from React state.
  useEffect(() => {
    const el = audioElRef.current;
    if (!el || !directAudioUrl) return;
    if (isPlaying) {
      el.play().catch(() => {/* autoplay may be blocked momentarily */});
    } else {
      el.pause();
    }
  }, [isPlaying, directAudioUrl]);

  useEffect(() => {
    const el = audioElRef.current;
    if (el) el.volume = Math.max(0, Math.min(1, volume / 100));
  }, [volume, directAudioUrl]);

  useEffect(() => {
    if (!onboardingPrefs) {
      setAiRecommendedSongs([]);
      setAiRecommendationError('');
      setIsRecommendationLoading(false);
      return;
    }

    let isMounted = true;
    let retryHandle: number | null = null;
    setIsRecommendationLoading(true);
    setAiRecommendationError('');

    // In packaged builds the embedded API spawns slightly after window load, so the first
    // recommendation pass can race ahead of it. Retry with backoff (1s, 2s, 4s, 8s, 16s)
    // before surfacing an error so a cold start still produces recs without user action.
    const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000];

    const runRound = (attempt: number) => {
      const directory = songDirectoryRef.current;
      const likedSongs = Array.from(likedSongIds)
        .map((id) => directory.get(id))
        .filter((song): song is Song => Boolean(song));
      const recentSongs = recentlyPlayedIds
        .map((id) => directory.get(id))
        .filter((song): song is Song => Boolean(song));

      const profile = buildUserProfile({
        prefs: onboardingPrefs,
        likedSongs,
        recentSongs,
        currentSong,
      });
      // Use up to 10 seeds (was 6) for a bigger pool — combined with the YT Music
      // source below we now have ~80 candidates to rank instead of ~18.
      const seeds = buildSeedQueries(profile).slice(0, 10);
      if (seeds.length === 0) {
        setAiRecommendedSongs([]);
        setIsRecommendationLoading(false);
        return;
      }

      const collected: Song[] = [];
      const seenIds = new Set<string>();
      let firstShown = false;

      const addSongs = (songs: Song[]) => {
        songs.forEach((song) => {
          // De-dupe across both sources by videoId — iTunes IDs and YT Music IDs
          // differ but the videoId is the canonical key for "same playable song".
          const key = song.videoId || song.id;
          if (seenIds.has(key)) return;
          seenIds.add(key);
          collected.push(song);
        });
        const ranked = rankAndDiversify(collected, profile, 12);
        if (ranked.length > 0) {
          setAiRecommendedSongs(ranked);
          setAiRecommendationError('');
        }
        if (!firstShown && ranked.length > 0) {
          firstShown = true;
          setIsRecommendationLoading(false);
        }
      };

      const itunesTasks = seeds.map(({ query, country }) =>
        searchSongsOnline(query, 4, country)
          .then((res) => { if (isMounted) addSongs(res.data ?? []); })
          .catch(() => {}),
      );

      // YT Music as second source — music-only results with built-in popularity
      // signal. Combined with iTunes the engine has more variety to rank.
      const ytmusicTasks = seeds.slice(0, 6).map(({ query }) =>
        fetch('/api/search/ytmusic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: 6 }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { results?: Song[] } | null) => {
            if (isMounted && data?.results) addSongs(data.results);
          })
          .catch(() => {}),
      );

      const tasks = [...itunesTasks, ...ytmusicTasks];

      Promise.all(tasks).then(() => {
        if (!isMounted) return;
        if (collected.length > 0) {
          setIsRecommendationLoading(false);
          return;
        }
        const nextDelay = RETRY_DELAYS[attempt];
        if (nextDelay !== undefined) {
          retryHandle = window.setTimeout(() => runRound(attempt + 1), nextDelay);
        } else {
          setIsRecommendationLoading(false);
          setAiRecommendationError('Could not find tracks for your preferences yet.');
        }
      });
    };

    const initialHandle = window.setTimeout(() => runRound(0), 350);

    return () => {
      isMounted = false;
      window.clearTimeout(initialHandle);
      if (retryHandle !== null) window.clearTimeout(retryHandle);
    };
    // currentSong is intentionally omitted from deps — refetching the home grid every
    // time the user picks a song caused the visible flicker the user reported. The
    // current song is read at runtime via songDirectoryRef so it still feeds the soft
    // signal without retriggering this effect.
  }, [onboardingPrefs, likedSongIds, recentlyPlayedIds]);

  const handleSignIn = async (email: string, password: string) => {
    if (!supabase) return { error: supabaseConfigError ?? 'Supabase is not configured.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    if (!supabase) return { error: supabaseConfigError ?? 'Supabase is not configured.' };
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    return error ? { error: error.message } : {};
  };

  const handleSignUp = async (fullName: string, email: string, password: string) => {
    if (!supabase) return { error: supabaseConfigError ?? 'Supabase is not configured.' };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    await sendWelcomeEmail({ email, fullName });
    if (!data.session) {
      return { notice: 'Account created. Check your email to confirm your account, then sign in.' };
    }
    return {};
  };

  const handlePasswordResetRequest = async (email: string) =>
    requestPasswordResetEmail({ email });

  const handlePasswordUpdate = async (newPassword: string) => {
    if (!supabase) return { error: supabaseConfigError ?? 'Supabase is not configured.' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setAuthNotice('Password updated successfully. Please sign in with your new password.');
    setIsPasswordRecoveryMode(false);
    clearRecoveryParamsFromUrl();
    return {};
  };

  const handleExitRecoveryMode = () => {
    setIsPasswordRecoveryMode(false);
    clearRecoveryParamsFromUrl();
  };

  const menuKicker: Record<string, string> = {
    home: 'Discover',
    search: 'Search',
    library: 'Library',
    playlists: 'Playlists',
    'ai-dj': 'Live',
    mood: 'Mood Music',
  };

  const menuTitle: Record<string, string> = {
    home: `Welcome back, ${displayName}`,
    search: 'Find Your Next Track',
    library: 'Your Music Library',
    playlists: 'Your Playlists',
    'ai-dj': 'Live Listening Session',
    mood: 'Music by Mood',
  };

  const renderSongsGrid = (songs: Song[], emptyMessage: string, isLoading = false) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-6 gap-8">
          {Array.from({ length: 6 }).map((_, idx) => (
            <motion.div key={idx} variants={itemVariants}>
              <SongCard
                song={{ id: `skeleton-${idx}`, title: '', artist: '', album: '', coverUrl: '', isLiked: false, duration: 0, videoId: '' }}
                isLoading={true}
              />
            </motion.div>
          ))}
        </div>
      );
    }
    if (songs.length === 0) {
      return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
    }
    return (
      <div className="grid grid-cols-6 gap-8">
        {songs.map((song) => (
          <motion.div key={song.id} variants={itemVariants}>
            <SongCard song={song} onPlay={handlePlaySong} onLike={handleLikeSong} />
          </motion.div>
        ))}
      </div>
    );
  };

  const renderPlaylistsGrid = (playlists: typeof mockPlaylists, emptyMessage: string) => {
    if (playlists.length === 0) {
      return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
    }
    return (
      <div className="grid grid-cols-4 gap-10">
        {playlists.map((playlist) => (
          <motion.div key={playlist.id} variants={itemVariants}>
            <PlaylistCard
              playlist={playlist}
              onPlay={() => console.log('Playing playlist:', playlist.name)}
            />
          </motion.div>
        ))}
      </div>
    );
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 md:p-10">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (isPasswordRecoveryMode) {
    return (
      <ResetPasswordPage
        onUpdatePassword={handlePasswordUpdate}
        onBack={handleExitRecoveryMode}
        configError={supabaseConfigError}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onSignIn={handleSignIn}
        onOAuthSignIn={handleOAuthSignIn}
        onSignUp={handleSignUp}
        onRequestPasswordReset={handlePasswordResetRequest}
        configError={supabaseConfigError}
        initialNotice={authNotice}
        onInitialNoticeShown={() => setAuthNotice('')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <CustomCursor />
      {isOffline && (
        <div className="fixed left-20 right-0 top-0 z-[90] flex items-center justify-center gap-2 bg-amber-500/90 px-4 py-1.5 text-xs font-medium text-amber-950">
          You are offline. Browsing your downloads — audio playback needs internet.
        </div>
      )}
      <Sidebar
        activeItem={activeMenuItem}
        onItemClick={handleMenuChange}
        onAddWidget={() => setActiveMenuItem('manage-widgets')}
        onRemoveWidget={handleToggleWidgetWithRedirect}
        activeWidgetIds={activeWidgetIds}
      />
      {/* When yt-dlp extracted a direct audio URL, prefer plain HTML5 <audio> over the
          YouTube iframe — bypasses every embed restriction (error 150). The iframe is
          only used as a fallback when extraction fails. */}
      {directAudioUrl && (
        <audio
          ref={audioElRef}
          src={directAudioUrl}
          preload="auto"
          onTimeUpdate={(e) => {
            const dur = e.currentTarget.duration;
            const cur = e.currentTarget.currentTime;
            setCurrentTime(cur);
            if (dur > 0) setProgress((cur / dur) * 100);
          }}
          onEnded={playNext}
          onError={() => {
            // Direct stream URLs can fail (signed URL expired, network glitch). Drop
            // the URL so the iframe-based player takes over for this song.
            setDirectAudioUrl(null);
          }}
          style={{ position: 'fixed', bottom: 0, right: 0, width: '1px', height: '1px', opacity: 0, pointerEvents: 'none', zIndex: -1 }}
          aria-hidden="true"
        />
      )}
      {/* Hidden global ReactPlayer fallback when no direct audio URL is available. */}
      <div
        style={
          {
            position: "fixed",
            bottom: 0,
            right: 0,
            width: "1px",
            height: "1px",
            opacity: 0,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: -1,
            display: directAudioUrl ? 'none' : 'block',
          }
        }
      >
        <ReactPlayer
          ref={playerRef}
          src={
            // Mount iframe ONLY when yt-dlp has explicitly given up — prevents the
            // iframe from spamming error 150 in the seconds before audio extraction
            // returns a usable URL.
            !directAudioUrl && audioStreamResolved && currentSong?.videoId
              ? `https://www.youtube-nocookie.com/watch?v=${currentSong.videoId}`
              : undefined
          }
          playing={isPlaying && !directAudioUrl && audioStreamResolved}
          controls={true}
          width="320px"
          height="60px"
          volume={volume / 100}
          onEnded={playNext}
          onError={() => {
            // YouTube error 150/101 = embed disabled. Many label-uploaded music videos
            // block embedding, but a Topic upload or audio-only version of the same song
            // is usually fine. Ask the server for an alternate videoId for the SAME song
            // before giving up. After 5 failures, surface a notice and stop trying — do
            // NOT auto-skip to a different song since the user explicitly picked this one.
            const song = currentSong;
            if (!song) return;
            const failedKey = song.id;
            if (altLookupInFlightRef.current === failedKey) return;

            const triedSet = triedVideoIdsRef.current.get(failedKey) ?? new Set<string>();
            if (song.videoId) triedSet.add(song.videoId);
            triedVideoIdsRef.current.set(failedKey, triedSet);

            if (triedSet.size >= 5) {
              setPlaybackNotice(`This song isn't available for playback. Try another track.`);
              setIsPlaying(false);
              setCurrentSong((curr) => {
                if (!curr || curr.id !== failedKey) return curr;
                return { ...curr, videoId: '' };
              });
              return;
            }

            altLookupInFlightRef.current = failedKey;
            const params = new URLSearchParams({
              title: song.title,
              artist: song.artist,
              exclude: Array.from(triedSet).join(','),
            });
            fetch(`/api/resolve-alt?${params.toString()}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((data: { videoId?: string } | null) => {
                altLookupInFlightRef.current = null;
                if (!data?.videoId) {
                  setPlaybackNotice(`This song isn't available for playback. Try another track.`);
                  setIsPlaying(false);
                  setCurrentSong((curr) => {
                    if (!curr || curr.id !== failedKey) return curr;
                    return { ...curr, videoId: '' };
                  });
                  return;
                }
                // Only swap the videoId if the user hasn't already moved on to a
                // different song while this lookup was in flight — otherwise we'd
                // clobber their new selection with the old (failing) one.
                setCurrentSong((curr) => {
                  if (!curr || curr.id !== failedKey) return curr;
                  return { ...curr, videoId: data.videoId! };
                });
              })
              .catch(() => {
                altLookupInFlightRef.current = null;
                setPlaybackNotice(`This song isn't available for playback. Try another track.`);
                setIsPlaying(false);
                setCurrentSong((curr) => {
                  if (!curr || curr.id !== failedKey) return curr;
                  return { ...curr, videoId: '' };
                });
              });
          }}
          onTimeUpdate={handleReactPlayerTimeUpdate}
          // youtube-video-element (react-player v3's underlying element) spreads config
          // directly into the iframe URL params — nesting under `youtube` would set a
          // useless `youtube=[object]` param. Passing flat keys ensures `origin` actually
          // reaches the iframe so postMessage between parent and YouTube works.
          config={{
            origin: youtubeOrigin,
            rel: 0,
            enablejsapi: 1,
          } as never}
        />
      </div>
      {/* Playback notices removed as requested: no popups, banners, or visible playbackNotice UI */}
      <TopNavigation
        displayName={displayName}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        suggestions={onlineSearchSongs}
        isSuggestionsLoading={isOnlineSearchLoading}
        onSuggestionPick={(song) => {
          setSearchQuery('');
          void handlePlaySong(song);
        }}
      />

      <main className="pt-40 pb-40 px-12 ml-20">
        <div className="max-w-[1800px] mx-auto">
          <motion.div
            className="mb-24"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-16">
              <motion.p
                className="text-xs text-muted-foreground mb-3 tracking-[0.2em] uppercase"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                {menuKicker[activeMenuItem] ?? 'Discover'}
              </motion.p>
              <motion.h1
                className="text-7xl mb-4 tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {menuTitle[activeMenuItem] ?? `Welcome back, ${displayName}`}
              </motion.h1>
            </div>
          </motion.div>

          {activeMenuItem === 'home' && (
            <>
              <motion.section className="mb-24" variants={containerVariants} initial="hidden" animate="visible">
                <motion.div className="mb-10" variants={itemVariants}>
                  <p className="text-xs text-muted-foreground mb-2 tracking-[0.2em] uppercase">For You</p>
                  <h2 className="text-4xl tracking-tight">Recommended Songs</h2>
                  {aiRecommendationError && (
                    <p className="text-xs mt-2 text-amber-400">{aiRecommendationError}</p>
                  )}
                </motion.div>
                {renderSongsGrid(
                  recommendedSongsView,
                  'Play or like a few songs to unlock personalized recommendations.',
                  isRecommendationLoading,
                )}
              </motion.section>

              <motion.section className="mb-32" variants={containerVariants} initial="hidden" animate="visible">
                <motion.div className="mb-10" variants={itemVariants}>
                  <p className="text-xs text-muted-foreground mb-2 tracking-[0.2em] uppercase">History</p>
                  <h2 className="text-4xl tracking-tight">Last Sessions</h2>
                </motion.div>
                {renderSongsGrid(filteredRecentlyPlayed, 'Play a few songs to build your session history.')}
              </motion.section>
            </>
          )}

          {activeMenuItem === 'search' && (
            <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
              <motion.div className="mb-10" variants={itemVariants}>
                <h2 className="text-4xl tracking-tight">Search Results</h2>
                <p className="text-sm mt-3 text-muted-foreground">
                  {normalizedSearch
                    ? `Showing songs that match "${searchQuery}"`
                    : 'Type in the search bar to find songs.'}
                </p>
                {normalizedSearch && isOnlineSearchLoading && (
                  <p className="text-xs mt-2 text-muted-foreground">Searching online songs...</p>
                )}
                {onlineSearchError && (
                  <p className="text-xs mt-2 text-destructive">{onlineSearchError}</p>
                )}
                {playbackNotice && (
                  <p className="text-xs mt-2 text-amber-400">{playbackNotice}</p>
                )}
              </motion.div>
              <motion.div variants={itemVariants}>
                {renderSongsGrid(
                  searchSongsForView,
                  normalizedSearch ? 'No songs found for this search.' : 'Type a song, artist, or album to begin.',
                  normalizedSearch ? isOnlineSearchLoading : false,
                )}
              </motion.div>
            </motion.section>
          )}

          {activeMenuItem === 'library' && (
            <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
              <motion.div className="mb-10" variants={itemVariants}>
                <div className="flex flex-col gap-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Library</p>
                    <h2 className="text-4xl tracking-tight">Your Library</h2>
                  </div>
                  <Tabs value={libraryTab} onValueChange={(value) => setLibraryTab(value as 'played' | 'liked')}>
                    <TabsList className="max-w-md">
                      <TabsTrigger value="played">Played</TabsTrigger>
                      <TabsTrigger value="liked">Liked</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </motion.div>
              {libraryTab === 'played'
                ? renderSongsGrid(playedSongsView, 'Play a song and it will show up here.')
                : renderSongsGrid(filteredLikedSongs, 'You have no liked songs yet.')}
            </motion.section>
          )}

          {activeMenuItem === 'playlists' && (
            <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
              <motion.div className="mb-10" variants={itemVariants}>
                <h2 className="text-4xl tracking-tight">All Playlists</h2>
              </motion.div>
              {renderPlaylistsGrid(filteredAllPlaylists, 'No playlists match your search.')}
            </motion.section>
          )}

          {activeMenuItem === 'mood' && (
            <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
              <MoodView
                preferredLanguages={onboardingPrefs?.languages ?? []}
                onPlaySong={handlePlaySong}
                onLikeSong={handleLikeSong}
                likedSongIds={likedSongIds}
              />
            </motion.section>
          )}

          {(activeMenuItem === 'ai-dj' || activeMenuItem === 'multiuser') && (
            <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
              <motion.div className="mb-10 flex items-center gap-4" variants={itemVariants}>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                  <Users className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground tracking-[0.2em] uppercase">Live Session</p>
                  <h2 className="text-4xl tracking-tight">Collaborative Listening</h2>
                </div>
              </motion.div>
              <MultiUserSession
                currentSongId={currentSong?.id ?? null}
                currentSongTitle={currentSong?.title ?? null}
                currentSongArtist={currentSong?.artist ?? null}
              />
            </motion.section>
          )}

          {activeMenuItem === 'manage-widgets' && (
            <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
              <WidgetManagerPage activeWidgetIds={activeWidgetIds} onToggle={handleToggleWidgetWithRedirect} />
            </motion.section>
          )}

          {(() => {
            const widgetDef = WIDGET_REGISTRY.find((w) => w.id === activeMenuItem);
            if (!widgetDef || !activeWidgetIds.includes(widgetDef.id)) return null;
            const Page = widgetDef.PageComponent;
            return (
              <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
                <Page
                  ctx={{
                    currentSong,
                    isPlaying,
                    recentSongs: recentlyPlayedSongs,
                    likedSongs: candidatePool.filter((song) => likedSongIds.has(song.id)),
                    onboardingPrefs,
                    onPlaySong: handlePlaySong,
                    onPlayPause: handlePlayPause,
                    onSelectMood: handleSelectMoodFromWidget,
                  }}
                />
              </motion.section>
            );
          })()}
        </div>
      </main>

      {!isAIAssistantOpen && (
        <motion.button
          onClick={() => setIsAIAssistantOpen(true)}
          className="fixed right-8 bottom-24 z-[70] flex items-center gap-3 px-6 py-4 rounded-full bg-accent text-accent-foreground hover:brightness-110 transition-all group shadow-2xl ring-1 ring-accent/40"
          whileHover={{ scale: 1.05, boxShadow: '0 24px 50px rgba(216, 163, 92, 0.45)' }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span className="text-sm font-semibold">AI Curator</span>
        </motion.button>
      )}

      <MusicPlayer
        currentSong={currentSong}
        isPlaying={isPlaying}
        progress={progress}
        volume={volume}
        repeatMode={repeatMode}
        onVolumeChange={setVolume}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onShowLyrics={() => setIsLyricsOpen(true)}
        onRepeatModeChange={handleRepeatModeChange}
        onProgressChange={handleProgressChange}
      />

      <AIAssistant
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        currentSong={currentSong}
        likedSongs={candidatePool.filter((song) => likedSongIds.has(song.id))}
        recentSongs={recentlyPlayedSongs}
        preferredLanguages={effectiveLanguages}
        contentLanguage={contentLanguage}
        onContentLanguageChange={setContentLanguage}
        onPlaySong={handlePlaySong}
        onAddToLibrary={(songs) => {
          songs.forEach((song) => {
            songDirectoryRef.current.set(song.id, song);
          });
          setRecentlyPlayedSongs((prev) => {
            const existing = new Set(prev.map((s) => s.id));
            const additions = songs.filter((s) => !existing.has(s.id));
            return [...additions, ...prev].slice(0, RECENT_SONGS_LIMIT);
          });
        }}
      />

      <SongDetailsPage
        song={currentSong}
        nextSongs={queuePreviewSongs}
        isOpen={isLyricsOpen}
        onClose={() => setIsLyricsOpen(false)}
        isPlaying={isPlaying}
        progress={progress}
        onPlayPause={handlePlayPause}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        displayName={displayName}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />

    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

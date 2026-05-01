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

  const handlePlaySong = (song: Song) => {
    if (!song.videoId || song.videoId.length !== 11) {
      setPlaybackNotice(
        `"${song.title}" does not include a valid YouTube videoId yet, so playback is unavailable for this search result.`,
      );
      setIsPlaying(false);
      console.warn('Blocked playback for song without valid videoId:', song);
      return;
    }
    setPlaybackNotice('');
    setCurrentSong(song);
    setIsPlaying(true);
    setProgress(0);
    setCurrentTime(0);
    const index = candidatePool.findIndex((s) => s.id === song.id);
    setCurrentSongIndex(index !== -1 ? index : -1);
    repeatOneUsedRef.current = false;
    setRecentlyPlayedSongs((prev) => pushRecentSong(prev, song));
    void logRecommendationEvent({
      eventType: 'play',
      songId: song.id,
      likedSongIds: [...likedSongIds],
      recentlyPlayedIds: [song.id, ...recentlyPlayedIds.filter((id) => id !== song.id)].slice(0, 6),
      currentSongId: song.id,
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

    const nextIndex = candidatePool.findIndex((song) => song.id === nextSong!.id);
    setCurrentSongIndex(nextIndex !== -1 ? nextIndex : -1);
    setCurrentSong(nextSong);
    setIsPlaying(true);
    setProgress(0);
    setCurrentTime(0);
    setPlaybackNotice('');
    repeatOneUsedRef.current = false;
    setRecentlyPlayedSongs((prev) => pushRecentSong(prev, nextSong!));
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
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(nextTime, 'seconds');
    } else if (playerRef.current && typeof playerRef.current.currentTime === 'number') {
      playerRef.current.currentTime = nextTime;
    }
  };

  const handlePrevious = () => {
    if (recentlyPlayedSongs.length > 1) {
      const previousSong = recentlyPlayedSongs[1];
      const idx = candidatePool.findIndex((song) => song.id === previousSong.id);
      setCurrentSongIndex(idx);
      setCurrentSong(previousSong);
      setIsPlaying(true);
      setProgress(0);
      setCurrentTime(0);
      setPlaybackNotice('');
      repeatOneUsedRef.current = false;
      setRecentlyPlayedSongs((prev) => pushRecentSong(prev, previousSong));
      return;
    }
    const pool = candidatePool;
    if (pool.length === 0) return;
    const prevIndex = currentSongIndex <= 0 ? pool.length - 1 : currentSongIndex - 1;
    setCurrentSongIndex(prevIndex);
    setCurrentSong(pool[prevIndex]);
    setIsPlaying(true);
    setProgress(0);
    setCurrentTime(0);
    setPlaybackNotice('');
    repeatOneUsedRef.current = false;
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
    let isMounted = true;
    setIsOnlineSearchLoading(true);
    setOnlineSearchError('');
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
    }, 260);
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
    setIsOnboardingOpen(false);
  };

  const handleMenuChange = (item: string) => {
    if (item !== 'search' && searchQuery.trim().length > 0) {
      setSearchQuery('');
    }
    setActiveMenuItem(item);
  };

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.likedSongIds, JSON.stringify([...likedSongIds]));
  }, [likedSongIds]);

  useEffect(() => {
    window.localStorage.setItem('whisky-recent-songs', JSON.stringify(recentlyPlayedSongs));
  }, [recentlyPlayedSongs]);

  useEffect(() => {
    if (!onboardingPrefs) {
      setAiRecommendedSongs([]);
      setAiRecommendationError('');
      setIsRecommendationLoading(false);
      return;
    }

    let isMounted = true;
    setIsRecommendationLoading(true);
    setAiRecommendationError('');

    const handle = window.setTimeout(() => {
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
      const seeds = buildSeedQueries(profile).slice(0, 6);
      if (seeds.length === 0) {
        setAiRecommendedSongs([]);
        setIsRecommendationLoading(false);
        return;
      }

      const collected: Song[] = [];
      const seenIds = new Set<string>();
      let firstShown = false;

      const tasks = seeds.map(({ query, country }) =>
        searchSongsOnline(query, 3, country)
          .then((res) => {
            if (!isMounted) return;
            (res.data ?? []).forEach((song) => {
              if (seenIds.has(song.id)) return;
              seenIds.add(song.id);
              collected.push(song);
            });
            const ranked = rankAndDiversify(collected, profile, 12);
            setAiRecommendedSongs(ranked);
            if (!firstShown && ranked.length > 0) {
              firstShown = true;
              setIsRecommendationLoading(false);
            }
          })
          .catch(() => {}),
      );

      Promise.all(tasks).then(() => {
        if (!isMounted) return;
        setIsRecommendationLoading(false);
        if (collected.length === 0) {
          setAiRecommendationError('Could not find tracks for your preferences yet.');
        }
      });
    }, 350);

    return () => {
      isMounted = false;
      window.clearTimeout(handle);
    };
  }, [onboardingPrefs, currentSong?.id, likedSongIds, recentlyPlayedIds]);

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
      {/* Hidden global ReactPlayer keeps playback state and progress in sync. */}
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
          }
        }
      >
        <ReactPlayer
          ref={playerRef}
          src={currentSong?.videoId ? `https://www.youtube.com/watch?v=${currentSong.videoId}` : undefined}
          playing={isPlaying}
          controls={true}
          width="320px"
          height="60px"
          volume={volume / 100}
          onEnded={playNext}
          onError={() => {
            setPlaybackNotice('Playback failed.');
          }}
          onTimeUpdate={handleReactPlayerTimeUpdate}
          config={{
            youtube: {
              origin: youtubeOrigin,
              rel: 0,
              enablejsapi: 1,
            },
          }}
        />
      </div>
      {/* Playback notices removed as requested: no popups, banners, or visible playbackNotice UI */}
      <TopNavigation
        displayName={displayName}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
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

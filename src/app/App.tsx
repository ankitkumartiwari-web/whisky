import { useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { TopNavigation } from './components/TopNavigation';
import { SongCard } from './components/SongCard';
import { PlaylistCard } from './components/PlaylistCard';
import MusicPlayer from './components/MusicPlayer';
import ReactPlayer from 'react-player';
import { MultiUserSession } from './components/MultiUserSession';
import { AIAssistant } from './components/AIAssistant';
import { SongDetailsPage } from './components/SongDetailsPage';
import { CustomCursor } from './components/CustomCursor';
import { LoginPage } from './components/LoginPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { Skeleton } from './components/ui/skeleton';
import { Sparkles, Users } from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import { supabase, supabaseConfigError } from './lib/supabaseClient';
import { requestPasswordResetEmail, sendWelcomeEmail } from './lib/resendApi';
import { searchSongsOnline } from './lib/songSearchApi';
import { getRecommendations } from './lib/recommendationApi';
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
  searchQuery: 'whisky-search-query',
  likedSongIds: 'whisky-liked-song-ids',
} as const;

const VALID_MENU_ITEMS = new Set([
  'home', 'search', 'library', 'playlists', 'liked', 'ai-dj', 'mood', 'multiuser',
]);

function getStoredActiveMenuItem(): string {
  const value = window.localStorage.getItem(STORAGE_KEYS.activeMenuItem);
  return value && VALID_MENU_ITEMS.has(value) ? value : 'home';
}

function getStoredSearchQuery(): string {
  return window.localStorage.getItem(STORAGE_KEYS.searchQuery) ?? '';
}

function getStoredLikedSongIds(): Set<string> {
  const fallback = new Set(mockSongs.filter((song) => song.isLiked).map((song) => song.id));
  const raw = window.localStorage.getItem(STORAGE_KEYS.likedSongIds);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const validIds = new Set(mockSongs.map((song) => song.id));
    return new Set(parsed.filter((id) => typeof id === 'string' && validIds.has(id)));
  } catch {
    return fallback;
  }
}

function getStoredRecentSongIds(): string[] {
  const raw = window.localStorage.getItem('whisky-recent-song-ids');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === 'string');
  } catch {
    return [];
  }
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(isPasswordRecoveryRequest);
  const [authNotice, setAuthNotice] = useState('');
  const [displayName, setDisplayName] = useState('Listener');
  const [activeMenuItem, setActiveMenuItem] = useState(getStoredActiveMenuItem);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(70); // 0-100
  const [searchQuery, setSearchQuery] = useState(getStoredSearchQuery);
  const [likedSongIds, setLikedSongIds] = useState<Set<string>>(getStoredLikedSongIds);
  const [recentlyPlayedIds, setRecentlyPlayedIds] = useState<string[]>(getStoredRecentSongIds);
  const [aiRecommendedSongIds, setAiRecommendedSongIds] = useState<string[]>([]);
  const [aiRecommendationError, setAiRecommendationError] = useState('');
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);
  const [aiRerankedSongIds, setAiRerankedSongIds] = useState<string[]>([]);
  const [onlineSearchSongs, setOnlineSearchSongs] = useState<Song[]>([]);
  const [onlineSearchSource, setOnlineSearchSource] = useState<string>('none');
  const [isOnlineSearchLoading, setIsOnlineSearchLoading] = useState(false);
  const [onlineSearchError, setOnlineSearchError] = useState('');
  const [playbackNotice, setPlaybackNotice] = useState('');
  const playerRef = useRef<HTMLVideoElement | null>(null);
  // For YouTube embed API, always set origin for best compatibility
  const youtubeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  // NOTE: For maximum compatibility, ReactPlayer is always mounted, never display:none, and playback is user-triggered on mobile due to browser autoplay policies.

  const applyLikedState = (songs: Song[]): Song[] =>
    songs.map((song) => ({ ...song, isLiked: likedSongIds.has(song.id) }));

  const allSongs = useMemo(() => applyLikedState(mockSongs), [likedSongIds]);
  const aiRecommendedSongs = useMemo(
    () => aiRecommendedSongIds
      .map((id) => allSongs.find((song) => song.id === id))
      .filter((song): song is Song => Boolean(song)),
    [aiRecommendedSongIds, allSongs],
  );
  const recommendedSongsView = aiRecommendedSongs;
  const recentlyPlayedView = useMemo(() => {
    if (!currentSong) return [];
    return applyLikedState([currentSong]);
  }, [likedSongIds, currentSong]);
  const trendingSongsView = useMemo(() => [], []);

  const pickSmartNextSong = (current: Song | null): Song | null => {
    if (!current) return null;

    const currentSongMeta = getSongMetadata(current.id);
    const currentArtistMeta = getArtistMetadata(current.artist);
    const candidates = allSongs.filter((song) => song.id !== current.id && isValidYouTubeVideoId(song.videoId));

    if (candidates.length === 0) return null;

    const scored = candidates
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

    return scored[0]?.score > 0 ? scored[0].song : candidates[0];
  };

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
    const index = mockSongs.findIndex((s) => s.id === song.id);
    if (index !== -1) setCurrentSongIndex(index);
    setRecentlyPlayedIds((prev) => {
      const next = [song.id, ...prev.filter((id) => id !== song.id)];
      return next.slice(0, 6);
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

  const handleNext = () => {
    const nextSong = pickSmartNextSong(currentSong) ?? allSongs[(currentSongIndex + 1) % mockSongs.length];
    const nextIndex = mockSongs.findIndex((song) => song.id === nextSong?.id);
    if (nextIndex !== -1) setCurrentSongIndex(nextIndex);
    setCurrentSong(nextSong);
    setIsPlaying(true);
    setProgress(0);
    setCurrentTime(0);
    setPlaybackNotice('');
  };

  // For ReactPlayer onEnd
  const playNext = () => {
    handleNext();
  };

  const handlePlayerProgress = (seconds: number) => {
    setCurrentTime(seconds);
    if (currentSong?.duration) {
      setProgress(Math.min(100, (seconds / currentSong.duration) * 100));
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
    if (playerRef.current) {
      playerRef.current.currentTime = nextTime;
    }
  };

  const handlePrevious = () => {
    const prevIndex = currentSongIndex === 0 ? mockSongs.length - 1 : currentSongIndex - 1;
    setCurrentSongIndex(prevIndex);
    setCurrentSong(allSongs[prevIndex]);
    setIsPlaying(true);
    setProgress(0);
    setCurrentTime(0);
    setPlaybackNotice('');
  };

  const handleLikeSong = (songId: string) => {
    setLikedSongIds((previous) => {
      const next = new Set(previous);
      next.has(songId) ? next.delete(songId) : next.add(songId);
      return next;
    });
    setCurrentSong((previous) => {
      if (!previous || previous.id !== songId) return previous;
      return { ...previous, isLiked: !previous.isLiked };
    });
  };

  const moodPlaylists = mockPlaylists.slice(0, 4);
  const aiPlaylists = mockPlaylists.slice(4, 6);
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

  const filteredRecentlyPlayed = filterSongs(recentlyPlayedView);
  const filteredLikedSongs = filterSongs(likedSongsView);
  const filteredAllSongs = filterSongs(allSongs);
  const filteredMoodPlaylists = filterPlaylists(moodPlaylists);
  const filteredAiPlaylists = filterPlaylists(aiPlaylists);
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
    return [...filteredAllSongs, ...external];
  }, [filteredAllSongs, onlineSearchSongs, normalizedSearch]);

  const searchSongsForView = useMemo(() => {
    if (aiRerankedSongIds.length === 0) return mergedSearchSongs;
    const map = new Map(mergedSearchSongs.map((song) => [song.id, song]));
    const ranked: Song[] = [];
    aiRerankedSongIds.forEach((songId) => {
      const match = map.get(songId);
      if (match) { ranked.push(match); map.delete(songId); }
    });
    return [...ranked, ...Array.from(map.values())];
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
      setOnlineSearchSource('none');
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
          setOnlineSearchSource('none');
          setOnlineSearchError(result.error);
          setIsOnlineSearchLoading(false);
          return;
        }
        setOnlineSearchSongs(result.data ?? []);
        setOnlineSearchSource(result.source ?? 'none');
        setOnlineSearchError('');
        setIsOnlineSearchLoading(false);
      });
    }, 260);
    return () => { isMounted = false; clearTimeout(timeoutHandle); };
  }, [normalizedSearch, searchQuery]);

  useEffect(() => {
    if (normalizedSearch && activeMenuItem !== 'search') setActiveMenuItem('search');
  }, [normalizedSearch, activeMenuItem]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.activeMenuItem, activeMenuItem);
  }, [activeMenuItem]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.searchQuery, searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.likedSongIds, JSON.stringify([...likedSongIds]));
  }, [likedSongIds]);

  useEffect(() => {
    window.localStorage.setItem('whisky-recent-song-ids', JSON.stringify(recentlyPlayedIds));
  }, [recentlyPlayedIds]);

  useEffect(() => {
    if (!recentlyPlayedIds.length && likedSongIds.size === 0 && !currentSong) {
      setAiRecommendedSongIds([]);
      setAiRecommendationError('');
      setIsRecommendationLoading(false);
      return;
    }

    let isMounted = true;
    setIsRecommendationLoading(true);
    setAiRecommendationError('');

    getRecommendations({
      songs: allSongs,
      playlists: mockPlaylists,
      likedSongIds: [...likedSongIds],
      recentlyPlayedIds,
      currentSongId: currentSong?.id ?? null,
      limit: 8,
    }).then((result) => {
      if (!isMounted) return;
      if (result.error || !result.data) {
        setAiRecommendedSongIds([]);
        setAiRecommendationError(result.error ?? 'Unable to generate recommendations.');
        setIsRecommendationLoading(false);
        return;
      }

      setAiRecommendedSongIds(result.data.songIds.filter((id) => id !== currentSong?.id));
      setAiRecommendationError('');
      setIsRecommendationLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [allSongs, currentSong, likedSongIds, recentlyPlayedIds]);

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
    liked: 'Favorites',
    'ai-dj': 'Live',
    mood: 'Mood Music',
  };

  const menuTitle: Record<string, string> = {
    home: `Welcome back, ${displayName}`,
    search: 'Find Your Next Track',
    library: 'Your Music Library',
    playlists: 'Your Playlists',
    liked: 'Songs You Like',
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

  const renderPlaylistSkeletonGrid = (count = 4) => (
    <div className="grid grid-cols-4 gap-10">
      {Array.from({ length: count }).map((_, idx) => (
        <motion.div key={`playlist-skeleton-${idx}`} variants={itemVariants}>
          <div className="space-y-4">
            <Skeleton className="aspect-square w-full rounded-3xl" />
            <div className="space-y-2 px-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );

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
      <Sidebar activeItem={activeMenuItem} onItemClick={setActiveMenuItem} />
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
            setPlaybackNotice('YouTube playback failed.');
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
        onSearchChange={setSearchQuery}
      />

      <main className="ml-20 pt-28 pb-40 px-12">
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
                  <h2 className="text-4xl tracking-tight">ML Recommendations</h2>
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
                  <p className="text-xs text-muted-foreground mb-2 tracking-[0.2em] uppercase">Now Playing</p>
                  <h2 className="text-4xl tracking-tight">Current Song</h2>
                </motion.div>
                {renderSongsGrid(recentlyPlayedView, 'No song is currently playing. Start a track to see it here.')}
              </motion.section>
            </>
          )}

          {activeMenuItem === 'search' && (
            <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
              <motion.div className="mb-10" variants={itemVariants}>
                <h2 className="text-4xl tracking-tight">Search Results</h2>
                <p className="text-sm mt-3 text-muted-foreground">
                  {normalizedSearch
                    ? `Showing matches for "${searchQuery}"`
                    : 'Type in the search bar to find songs and playlists.'}
                </p>
                {normalizedSearch && isOnlineSearchLoading && (
                  <p className="text-xs mt-2 text-muted-foreground">Searching online songs...</p>
                )}
                {normalizedSearch && !isOnlineSearchLoading && onlineSearchSource !== 'none' && (
                  <p className="text-xs mt-2 text-muted-foreground">Online source: {onlineSearchSource}</p>
                )}
                {onlineSearchError && (
                  <p className="text-xs mt-2 text-destructive">{onlineSearchError}</p>
                )}
                {playbackNotice && (
                  <p className="text-xs mt-2 text-amber-400">{playbackNotice}</p>
                )}
              </motion.div>
              <motion.div className="mb-12" variants={itemVariants}>
                <h3 className="text-2xl mb-6 tracking-tight">Songs</h3>
                {renderSongsGrid(searchSongsForView, 'No songs found for this search.', isOnlineSearchLoading)}
              </motion.div>
              <motion.div variants={itemVariants}>
                <h3 className="text-2xl mb-6 tracking-tight">Playlists</h3>
                {normalizedSearch && isOnlineSearchLoading
                  ? renderPlaylistSkeletonGrid()
                  : renderPlaylistsGrid(filteredAllPlaylists, 'No playlists found for this search.')}
              </motion.div>
            </motion.section>
          )}

          {activeMenuItem === 'library' && (
            <>
              <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
                <motion.div className="mb-10" variants={itemVariants}>
                  <h2 className="text-4xl tracking-tight">Recently Played</h2>
                </motion.div>
                {renderSongsGrid(filteredRecentlyPlayed, 'No recent songs available right now.')}
              </motion.section>
              <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
                <motion.div className="mb-10" variants={itemVariants}>
                  <h2 className="text-4xl tracking-tight">Your Playlists</h2>
                </motion.div>
                {renderPlaylistsGrid(filteredAllPlaylists, 'No playlists available right now.')}
              </motion.section>
            </>
          )}

          {activeMenuItem === 'playlists' && (
            <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
              <motion.div className="mb-10" variants={itemVariants}>
                <h2 className="text-4xl tracking-tight">All Playlists</h2>
              </motion.div>
              {renderPlaylistsGrid(filteredAllPlaylists, 'No playlists match your search.')}
            </motion.section>
          )}

          {activeMenuItem === 'liked' && (
            <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
              <motion.div className="mb-10" variants={itemVariants}>
                <h2 className="text-4xl tracking-tight">Liked Songs</h2>
              </motion.div>
              {renderSongsGrid(filteredLikedSongs, 'You have no liked songs yet.')}
            </motion.section>
          )}

          {activeMenuItem === 'mood' && (
            <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
              <motion.div className="mb-10" variants={itemVariants}>
                <h2 className="text-4xl tracking-tight">Mood Playlists</h2>
              </motion.div>
              {renderPlaylistsGrid(filteredMoodPlaylists, 'No mood playlists match your search.')}
            </motion.section>
          )}

          {activeMenuItem === 'ai-dj' && (
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
                onJoinSession={() => alert('Joined session! (Sync logic to be implemented)')}
                onSyncToggle={(sync) => {
                  if (sync) {
                    alert('Sync Playback enabled! (Sync logic to be implemented)');
                  } else {
                    alert('Sync Playback disabled.');
                  }
                }}
              />
            </motion.section>
          )}

          {/* FIX: removed orphaned duplicate ai-dj section that was placed after multiuser without a condition */}
          {activeMenuItem === 'multiuser' && (
            <motion.section className="mb-20" variants={containerVariants} initial="hidden" animate="visible">
              <motion.div className="mb-10 flex items-center gap-4" variants={itemVariants}>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                  <Users className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground tracking-[0.2em] uppercase">Live Session</p>
                  <h2 className="text-4xl tracking-tight">Multi-User Listening</h2>
                </div>
              </motion.div>
              <MultiUserSession
                currentSongId={currentSong?.id ?? null}
                onJoinSession={() => alert('Joined session! (Sync logic to be implemented)')}
                onSyncToggle={(sync) => {
                  if (sync) {
                    alert('Sync Playback enabled! (Sync logic to be implemented)');
                  } else {
                    alert('Sync Playback disabled.');
                  }
                }}
              />
            </motion.section>
          )}
        </div>
      </main>

      <motion.button
        onClick={() => setIsAIAssistantOpen(!isAIAssistantOpen)}
        className="fixed right-8 bottom-36 z-[70] flex items-center gap-3 px-6 py-4 rounded-full bg-[#1DB954] text-[#0A0A0A] border-2 border-white/80 hover:bg-[#22C55E] transition-colors group shadow-2xl"
        whileHover={{ scale: 1.05, boxShadow: '0 24px 50px rgba(29, 185, 84, 0.45)' }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Sparkles className="w-5 h-5 text-[#0A0A0A] group-hover:rotate-12 transition-transform" />
        <span className="text-sm font-semibold text-[#0A0A0A]">AI Curator</span>
      </motion.button>

      <MusicPlayer
        currentSong={currentSong}
        isPlaying={isPlaying}
        progress={progress}
        volume={volume}
        onVolumeChange={setVolume}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onShowLyrics={() => setIsLyricsOpen(true)}
        onProgressChange={handleProgressChange}
      />

      <AIAssistant
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        songs={allSongs}
        playlists={mockPlaylists}
        searchResultSongIds={searchSongsForView.map((song) => song.id)}
        onApplyRerank={(songIds) => setAiRerankedSongIds(songIds)}
      />

      <SongDetailsPage
        song={currentSong}
        isOpen={isLyricsOpen}
        onClose={() => setIsLyricsOpen(false)}
        isPlaying={isPlaying}
        progress={progress}
        onPlayPause={handlePlayPause}
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

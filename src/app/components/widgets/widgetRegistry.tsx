import { BarChart3, Download, Heart, Mic2, Pause, Play, Sparkles, WifiOff, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Song } from '../../data/mockData';
import { useTheme } from '../../context/ThemeContext';
import {
  getTopArtists,
  getTopSongs,
  getTotalPlayCount,
  listSavedSongs,
  removeSongOffline,
  type AggregatedEntry,
  type StatsPeriod,
} from '../../lib/offlineStore';
import type { WidgetContext, WidgetDefinition } from './widgetTypes';

function WidgetShell({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#16161a' : '#ffffff';
  const text = isDark ? '#f4f4f5' : '#0a0a0a';
  const subtle = isDark ? 'rgba(244,244,245,0.65)' : 'rgba(10,10,10,0.6)';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  return (
    <div
      className="rounded-2xl p-4 shadow-lg"
      style={{ backgroundColor: cardBg, border: `1px solid ${borderCol}`, color: text }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: subtle }}>{title}</p>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-1"
          style={{ color: subtle }}
          title="Remove widget"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {children}
    </div>
  );
}

function MiniSongRow({ song, onPlay }: { song: Song; onPlay: (s: Song) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPlay(song)}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-background"
    >
      <img src={song.coverUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-md object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs">{song.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{song.artist}</p>
      </div>
    </button>
  );
}

function NowPlayingWidget({ ctx, onRemove }: { ctx: WidgetContext; onRemove: () => void }) {
  const { currentSong, isPlaying, onPlayPause } = ctx;
  return (
    <WidgetShell title="Now playing" onRemove={onRemove}>
      {currentSong ? (
        <div className="flex items-center gap-3">
          <img src={currentSong.coverUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{currentSong.title}</p>
            <p className="truncate text-xs text-muted-foreground">{currentSong.artist}</p>
          </div>
          <button
            type="button"
            onClick={onPlayPause}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[#0A0A0A] hover:bg-[var(--accent)]"
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nothing playing yet.</p>
      )}
    </WidgetShell>
  );
}

function NowPlayingPage({ ctx }: { ctx: WidgetContext }) {
  const { currentSong, isPlaying, onPlayPause } = ctx;
  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Now playing</p>
        <h2 className="text-4xl tracking-tight">What's on right now</h2>
      </div>
      {currentSong ? (
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-12 items-start">
          <img
            src={currentSong.coverUrl}
            alt=""
            className="aspect-square w-full rounded-3xl object-cover shadow-2xl"
          />
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{currentSong.album}</p>
              <h1 className="mt-1 text-5xl tracking-tight">{currentSong.title}</h1>
              <p className="mt-2 text-xl text-muted-foreground">{currentSong.artist}</p>
            </div>
            <button
              type="button"
              onClick={onPlayPause}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[#0A0A0A] hover:bg-[var(--accent)]"
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">Pick a song from anywhere in the app and it will live here.</p>
      )}
    </div>
  );
}

function RecentPlaysWidget({ ctx, onRemove }: { ctx: WidgetContext; onRemove: () => void }) {
  const items = ctx.recentSongs.slice(0, 4);
  return (
    <WidgetShell title="Recent plays" onRemove={onRemove}>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Play a song to see it here.</p>
      ) : (
        <div className="space-y-1">
          {items.map((song) => (
            <MiniSongRow key={song.id} song={song} onPlay={ctx.onPlaySong} />
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

function RecentPlaysPage({ ctx }: { ctx: WidgetContext }) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">History</p>
        <h2 className="text-4xl tracking-tight">Recent plays</h2>
      </div>
      {ctx.recentSongs.length === 0 ? (
        <p className="text-muted-foreground">Your recent plays will appear here.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {ctx.recentSongs.slice(0, 24).map((song) => (
            <button
              key={song.id}
              type="button"
              onClick={() => ctx.onPlaySong(song)}
              className="text-left group"
            >
              <img
                src={song.coverUrl}
                alt=""
                className="aspect-square w-full rounded-2xl object-cover transition-transform group-hover:scale-[1.02]"
              />
              <p className="mt-3 truncate text-sm">{song.title}</p>
              <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TopArtistsWidget({ ctx, onRemove }: { ctx: WidgetContext; onRemove: () => void }) {
  const counts = useArtistCounts(ctx);
  return (
    <WidgetShell title="Top artists" onRemove={onRemove}>
      {counts.length === 0 ? (
        <p className="text-xs text-muted-foreground">Build a listening history to see top artists.</p>
      ) : (
        <ul className="space-y-2">
          {counts.slice(0, 4).map(([artist, { song, count }]) => (
            <li key={artist} className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/10">
                <Mic2 className="h-3.5 w-3.5 text-accent" />
              </div>
              <button
                type="button"
                onClick={() => ctx.onPlaySong(song)}
                className="min-w-0 flex-1 text-left text-xs hover:text-foreground"
              >
                <p className="truncate">{artist}</p>
                <p className="truncate text-[11px] text-muted-foreground">{count} plays</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function useArtistCounts(ctx: WidgetContext) {
  return useMemo(() => {
    const tally = new Map<string, { count: number; song: Song }>();
    [...ctx.likedSongs.map((s) => ({ s, w: 3 })), ...ctx.recentSongs.map((s) => ({ s, w: 1 }))].forEach(
      ({ s, w }) => {
        const key = s.artist;
        const entry = tally.get(key);
        if (entry) entry.count += w;
        else tally.set(key, { count: w, song: s });
      },
    );
    return Array.from(tally.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [ctx.likedSongs, ctx.recentSongs]);
}

function TopArtistsPage({ ctx }: { ctx: WidgetContext }) {
  const counts = useArtistCounts(ctx);
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">For you</p>
        <h2 className="text-4xl tracking-tight">Top artists</h2>
      </div>
      {counts.length === 0 ? (
        <p className="text-muted-foreground">Listen and like songs — your top artists will appear here.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
          {counts.slice(0, 20).map(([artist, { song, count }]) => (
            <button
              key={artist}
              type="button"
              onClick={() => ctx.onPlaySong(song)}
              className="text-left group"
            >
              <div className="aspect-square w-full overflow-hidden rounded-full">
                <img
                  src={song.coverUrl}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-[1.05]"
                />
              </div>
              <p className="mt-3 truncate text-sm">{artist}</p>
              <p className="truncate text-xs text-muted-foreground">{count} plays</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const QUICK_MOODS = [
  { id: 'happy', label: 'Happy', gradient: 'from-amber-400 to-orange-500' },
  { id: 'chill', label: 'Chill', gradient: 'from-sky-400 to-indigo-500' },
  { id: 'workout', label: 'Workout', gradient: 'from-rose-500 to-red-600' },
  { id: 'focus', label: 'Focus', gradient: 'from-emerald-400 to-teal-500' },
];

function MoodShortcutWidget({ ctx, onRemove }: { ctx: WidgetContext; onRemove: () => void }) {
  return (
    <WidgetShell title="Mood shortcuts" onRemove={onRemove}>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_MOODS.map((mood) => (
          <button
            key={mood.id}
            type="button"
            onClick={() => ctx.onSelectMood(mood.id)}
            className="relative overflow-hidden rounded-xl px-3 py-3 text-left text-xs text-white"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${mood.gradient} opacity-95`} />
            <span className="relative">{mood.label}</span>
          </button>
        ))}
      </div>
    </WidgetShell>
  );
}

function MoodShortcutPage({ ctx }: { ctx: WidgetContext }) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Quick picks</p>
        <h2 className="text-4xl tracking-tight">Mood shortcuts</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Jump straight to a mood mix. For the full set, head to Mood Music.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {QUICK_MOODS.map((mood) => (
          <button
            key={mood.id}
            type="button"
            onClick={() => ctx.onSelectMood(mood.id)}
            className="relative overflow-hidden rounded-3xl px-6 py-10 text-left text-white"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${mood.gradient} opacity-95`} />
            <span className="relative text-xl font-semibold">{mood.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LikedSnapshotWidget({ ctx, onRemove }: { ctx: WidgetContext; onRemove: () => void }) {
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const items = useMemo(() => {
    const pool = [...ctx.likedSongs];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 4);
  }, [ctx.likedSongs, shuffleSeed]);

  return (
    <WidgetShell title="Liked snapshot" onRemove={onRemove}>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Like a few songs to see them here.</p>
      ) : (
        <>
          <div className="space-y-1">
            {items.map((song) => (
              <MiniSongRow key={song.id} song={song} onPlay={ctx.onPlaySong} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShuffleSeed((s) => s + 1)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Heart className="h-3 w-3" /> Shuffle
          </button>
        </>
      )}
    </WidgetShell>
  );
}

function LikedSnapshotPage({ ctx }: { ctx: WidgetContext }) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Favorites</p>
        <h2 className="text-4xl tracking-tight">Liked songs</h2>
      </div>
      {ctx.likedSongs.length === 0 ? (
        <p className="text-muted-foreground">Songs you heart will collect here.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {ctx.likedSongs.map((song) => (
            <button
              key={song.id}
              type="button"
              onClick={() => ctx.onPlaySong(song)}
              className="text-left group"
            >
              <img
                src={song.coverUrl}
                alt=""
                className="aspect-square w-full rounded-2xl object-cover transition-transform group-hover:scale-[1.02]"
              />
              <p className="mt-3 truncate text-sm">{song.title}</p>
              <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CuratorTipWidget({ ctx, onRemove }: { ctx: WidgetContext; onRemove: () => void }) {
  const tips = useTips(ctx);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setIdx((n) => (n + 1) % tips.length), 8000);
    return () => window.clearInterval(id);
  }, [tips.length]);

  return (
    <WidgetShell title="Curator tip" onRemove={onRemove}>
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-400">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <p className="text-xs leading-relaxed text-foreground/90">{tips[idx]}</p>
      </div>
    </WidgetShell>
  );
}

function useTips(ctx: WidgetContext) {
  return useMemo(() => {
    const fallback = [
      'Liking 5+ songs sharpens your daily mix.',
      'Try the AI Curator with "Songs that feel like X" for smart matches.',
      'Mood Music adapts to your onboarding language automatically.',
      'Synced lyrics auto-scroll with the song in the lyrics view.',
    ];
    if (!ctx.currentSong) return fallback;
    return [
      `${ctx.currentSong.artist} pairs well with similar ${ctx.currentSong.genre || 'tracks'} you might love.`,
      `Open lyrics on "${ctx.currentSong.title}" for backstory + synced lines.`,
      ...fallback,
    ];
  }, [ctx.currentSong]);
}

function CuratorTipPage({ ctx }: { ctx: WidgetContext }) {
  const tips = useTips(ctx);
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Daily insights</p>
        <h2 className="text-4xl tracking-tight">Curator tips</h2>
      </div>
      <ul className="space-y-3 max-w-3xl">
        {tips.map((tip, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-5 py-4"
          >
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="text-sm leading-relaxed">{tip}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function useSavedSongsState(): [Song[], () => void] {
  const [songs, setSongs] = useState<Song[]>([]);
  const refresh = () => {
    listSavedSongs().then(setSongs);
  };
  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('whisky:saved-songs-changed', handler);
    return () => window.removeEventListener('whisky:saved-songs-changed', handler);
  }, []);
  return [songs, refresh];
}

function DownloadsWidget({ ctx, onRemove }: { ctx: WidgetContext; onRemove: () => void }) {
  const [songs, refresh] = useSavedSongsState();
  const items = songs.slice(0, 4);
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <WidgetShell title={`Downloads (${songs.length})`} onRemove={onRemove}>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Tap the download icon on any song to save it.</p>
      ) : (
        <div className="space-y-1">
          {items.map((song) => (
            <button
              key={song.id}
              type="button"
              onClick={() => ctx.onPlaySong(song)}
              disabled={isOffline}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-background disabled:opacity-60"
              title={isOffline ? 'Audio needs internet (YouTube source)' : undefined}
            >
              <img src={song.coverUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-md object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{song.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{song.artist}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSongOffline(song.id).then(refresh);
                  window.dispatchEvent(new CustomEvent('whisky:saved-songs-changed'));
                }}
                className="text-muted-foreground hover:text-destructive"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </button>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

function DownloadsPage({ ctx }: { ctx: WidgetContext }) {
  const [songs, refresh] = useSavedSongsState();
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Available offline</p>
        <h2 className="text-4xl tracking-tight">Downloads</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Saved songs live in your browser. Cover art and metadata work offline; audio still streams from
          YouTube and needs internet to play.
        </p>
        {isOffline && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
            <WifiOff className="h-3 w-3" /> Offline — playback paused; browse freely.
          </p>
        )}
      </div>
      {songs.length === 0 ? (
        <p className="text-muted-foreground">
          Click the <Download className="inline h-3.5 w-3.5" /> icon on any song to save it for offline browsing.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {songs.map((song) => (
            <div key={song.id} className="group">
              <button
                type="button"
                onClick={() => ctx.onPlaySong(song)}
                disabled={isOffline}
                className="block w-full text-left disabled:cursor-not-allowed"
                title={isOffline ? 'Audio needs internet to play' : undefined}
              >
                <img
                  src={song.coverUrl}
                  alt=""
                  className={`aspect-square w-full rounded-2xl object-cover transition-transform ${
                    isOffline ? 'grayscale-[40%] opacity-80' : 'group-hover:scale-[1.02]'
                  }`}
                />
                <p className="mt-3 truncate text-sm">{song.title}</p>
                <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  removeSongOffline(song.id).then(refresh);
                  window.dispatchEvent(new CustomEvent('whisky:saved-songs-changed'));
                }}
                className="mt-2 text-[11px] text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function useStatsForPeriod(period: StatsPeriod) {
  const [topArtists, setTopArtists] = useState<AggregatedEntry[]>([]);
  const [topSongs, setTopSongs] = useState<AggregatedEntry[]>([]);
  const [totalPlays, setTotalPlays] = useState(0);

  const refresh = () => {
    Promise.all([getTopArtists(period), getTopSongs(period), getTotalPlayCount(period)]).then(
      ([artists, songs, total]) => {
        setTopArtists(artists);
        setTopSongs(songs);
        setTotalPlays(total);
      },
    );
  };

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('whisky:play-events-changed', handler);
    return () => window.removeEventListener('whisky:play-events-changed', handler);
  }, [period]);

  return { topArtists, topSongs, totalPlays };
}

function ListeningStatsWidget({ ctx, onRemove }: { ctx: WidgetContext; onRemove: () => void }) {
  const { topArtists, totalPlays } = useStatsForPeriod('month');
  return (
    <WidgetShell title="Top this month" onRemove={onRemove}>
      <p className="mb-3 text-[11px] text-muted-foreground">{totalPlays} plays in last 30 days</p>
      {topArtists.length === 0 ? (
        <p className="text-xs text-muted-foreground">Listen for a few days to see your top artists here.</p>
      ) : (
        <ul className="space-y-2">
          {topArtists.slice(0, 3).map((entry, idx) => (
            <li key={entry.key} className="flex items-center gap-2.5">
              <span className="w-4 text-center text-[11px] text-muted-foreground">{idx + 1}</span>
              <img
                src={entry.song.coverUrl}
                alt=""
                className="h-8 w-8 rounded-full object-cover flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{entry.key}</p>
                <p className="truncate text-[10px] text-muted-foreground">{entry.count} plays</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  ctx.onPlaySong({
                    id: entry.song.songId,
                    title: entry.song.title,
                    artist: entry.song.artist,
                    album: entry.song.album,
                    coverUrl: entry.song.coverUrl,
                    duration: 0,
                    isLiked: false,
                    videoId: entry.song.videoId,
                  } as Song)
                }
                className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                title="Play their flagship track"
              >
                <Play className="h-3 w-3 fill-current" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function ListeningStatsPage({ ctx }: { ctx: WidgetContext }) {
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const { topArtists, topSongs, totalPlays } = useStatsForPeriod(period);

  const playRecord = (entry: AggregatedEntry) => {
    ctx.onPlaySong({
      id: entry.song.songId,
      title: entry.song.title,
      artist: entry.song.artist,
      album: entry.song.album,
      coverUrl: entry.song.coverUrl,
      duration: 0,
      isLiked: false,
      videoId: entry.song.videoId,
    } as Song);
  };

  const periodLabel = period === 'month' ? 'last 30 days' : period === 'year' ? 'last 12 months' : 'all time';

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Stats</p>
        <h2 className="text-4xl tracking-tight">Your listening</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {totalPlays} {totalPlays === 1 ? 'play' : 'plays'} in the {periodLabel}.
        </p>
      </div>

      <div className="inline-flex rounded-full border border-border bg-secondary/40 p-1">
        {(['month', 'year', 'all'] as StatsPeriod[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              period === value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {value === 'month' ? 'Month' : value === 'year' ? 'Year' : 'All time'}
          </button>
        ))}
      </div>

      <section>
        <h3 className="text-sm uppercase tracking-[0.18em] text-muted-foreground mb-4">Top artists</h3>
        {topArtists.length === 0 ? (
          <p className="text-sm text-muted-foreground">Play some music — your top artists will live here.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-6">
            {topArtists.map((entry, idx) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => playRecord(entry)}
                className="text-left group"
              >
                <div className="aspect-square w-full overflow-hidden rounded-full">
                  <img
                    src={entry.song.coverUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.05]"
                  />
                </div>
                <p className="mt-3 truncate text-sm">
                  <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                  {entry.key}
                </p>
                <p className="truncate text-xs text-muted-foreground">{entry.count} plays</p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm uppercase tracking-[0.18em] text-muted-foreground mb-4">Top songs</h3>
        {topSongs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Once you play tracks, the most-played ones land here.</p>
        ) : (
          <ul className="space-y-2">
            {topSongs.map((entry, idx) => (
              <li key={entry.key}>
                <button
                  type="button"
                  onClick={() => playRecord(entry)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-left hover:bg-secondary/60"
                >
                  <span className="w-6 text-center text-sm text-muted-foreground">{idx + 1}</span>
                  <img src={entry.song.coverUrl} alt="" className="h-12 w-12 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{entry.song.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{entry.song.artist}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{entry.count} plays</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: 'now-playing',
    title: 'Now Playing',
    description: 'Current track with controls.',
    iconKey: 'now-playing',
    Component: NowPlayingWidget,
    PageComponent: NowPlayingPage,
  },
  {
    id: 'recent-plays',
    title: 'Recent Plays',
    description: 'Songs you played recently.',
    iconKey: 'recent',
    Component: RecentPlaysWidget,
    PageComponent: RecentPlaysPage,
  },
  {
    id: 'top-artists',
    title: 'Top Artists',
    description: 'Most-played artists weighted by likes + plays.',
    iconKey: 'top-artists',
    Component: TopArtistsWidget,
    PageComponent: TopArtistsPage,
  },
  {
    id: 'mood-shortcuts',
    title: 'Mood Shortcuts',
    description: 'Quick mood mixes.',
    iconKey: 'mood',
    Component: MoodShortcutWidget,
    PageComponent: MoodShortcutPage,
  },
  {
    id: 'liked-snapshot',
    title: 'Liked Songs',
    description: 'Your hearted tracks.',
    iconKey: 'liked',
    Component: LikedSnapshotWidget,
    PageComponent: LikedSnapshotPage,
  },
  {
    id: 'curator-tip',
    title: 'Curator Tips',
    description: 'Rotating insights about your library.',
    iconKey: 'curator',
    Component: CuratorTipWidget,
    PageComponent: CuratorTipPage,
  },
  {
    id: 'downloads',
    title: 'Downloads',
    description: 'Songs you saved for offline browsing.',
    iconKey: 'downloads',
    Component: DownloadsWidget,
    PageComponent: DownloadsPage,
  },
  {
    id: 'listening-stats',
    title: 'Listening Stats',
    description: 'Top artists and songs by month and year.',
    iconKey: 'stats',
    Component: ListeningStatsWidget,
    PageComponent: ListeningStatsPage,
  },
];

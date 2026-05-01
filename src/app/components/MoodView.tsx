import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Coffee, Dumbbell, Flame, Heart, Loader2, Moon, Music2, PartyPopper, Smile, Sparkles, Sun, Waves } from 'lucide-react';
import type { Song } from '../data/mockData';
import { SongCard } from './SongCard';
import { Skeleton } from './ui/skeleton';
import { searchSongsOnline } from '../lib/songSearchApi';

interface MoodViewProps {
  preferredLanguages: string[];
  onPlaySong: (song: Song) => void;
  onLikeSong: (songId: string) => void;
  likedSongIds: Set<string>;
}

interface Mood {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  queries: Record<string, string[]>;
}

const MOODS: Mood[] = [
  {
    id: 'happy',
    label: 'Happy',
    description: 'Feel-good upbeat',
    icon: Smile,
    gradient: 'from-amber-400 to-orange-500',
    queries: {
      Hindi: ['Bollywood happy hits', 'feel good Hindi songs'],
      Punjabi: ['Punjabi happy hits', 'Diljit Dosanjh upbeat'],
      Korean: ['K-Pop upbeat', 'TWICE happy songs'],
      Spanish: ['Latin happy hits', 'Bad Bunny upbeat'],
      Japanese: ['J-Pop happy', 'YOASOBI upbeat'],
      French: ['French pop upbeat'],
      English: ['feel good pop hits', 'happy upbeat songs'],
    },
  },
  {
    id: 'chill',
    label: 'Chill',
    description: 'Mellow lo-fi vibes',
    icon: Waves,
    gradient: 'from-sky-400 to-indigo-500',
    queries: {
      Hindi: ['Anuv Jain chill', 'Bollywood unplugged'],
      Punjabi: ['Punjabi acoustic chill'],
      Korean: ['K-indie chill', 'IU mellow'],
      Spanish: ['Spanish chill acoustic'],
      Japanese: ['lofi Japanese chill'],
      French: ['French chill acoustic'],
      English: ['lofi chill beats', 'chill acoustic indie'],
    },
  },
  {
    id: 'workout',
    label: 'Workout',
    description: 'High-energy push',
    icon: Dumbbell,
    gradient: 'from-rose-500 to-red-600',
    queries: {
      Hindi: ['Bollywood gym workout', 'high energy Hindi songs'],
      Punjabi: ['Punjabi workout gym', 'Sidhu Moose Wala'],
      Korean: ['K-Pop high energy', 'Stray Kids hype'],
      Spanish: ['Latin workout reggaeton', 'Bad Bunny high energy'],
      Japanese: ['J-Pop hype'],
      French: ['French rap high energy'],
      English: ['workout pump up hits', 'high energy gym songs'],
    },
  },
  {
    id: 'romantic',
    label: 'Romantic',
    description: 'Love ballads & duets',
    icon: Heart,
    gradient: 'from-pink-500 to-rose-500',
    queries: {
      Hindi: ['Arijit Singh romantic', 'Bollywood love songs'],
      Punjabi: ['Punjabi romantic songs', 'B Praak love'],
      Korean: ['K-Pop ballads romantic'],
      Spanish: ['Spanish love ballads'],
      Japanese: ['J-Pop ballads'],
      French: ['French love songs'],
      English: ['love ballads pop', 'romantic R&B'],
    },
  },
  {
    id: 'focus',
    label: 'Focus',
    description: 'Deep work flow',
    icon: Coffee,
    gradient: 'from-emerald-400 to-teal-500',
    queries: {
      Hindi: ['Hindi instrumental focus'],
      Punjabi: ['Punjabi instrumental'],
      Korean: ['K-Pop instrumental study'],
      Spanish: ['Spanish instrumental study'],
      Japanese: ['J-Pop instrumental focus'],
      French: ['French instrumental focus'],
      English: ['focus instrumental piano', 'study deep focus'],
    },
  },
  {
    id: 'party',
    label: 'Party',
    description: 'Dance-floor anthems',
    icon: PartyPopper,
    gradient: 'from-violet-500 to-purple-600',
    queries: {
      Hindi: ['Bollywood party hits', 'Hindi dance songs'],
      Punjabi: ['Punjabi party hits', 'Yo Yo Honey Singh'],
      Korean: ['K-Pop dance hits'],
      Spanish: ['reggaeton party hits'],
      Japanese: ['J-Pop dance party'],
      French: ['French dance hits'],
      English: ['party dance hits', 'club anthems'],
    },
  },
  {
    id: 'sad',
    label: 'Sad',
    description: 'Heartbreak & melancholy',
    icon: Music2,
    gradient: 'from-slate-500 to-slate-700',
    queries: {
      Hindi: ['Arijit Singh sad', 'Bollywood breakup songs'],
      Punjabi: ['Punjabi sad songs', 'B Praak sad'],
      Korean: ['K-Pop sad ballads'],
      Spanish: ['Spanish sad ballads'],
      Japanese: ['J-Pop sad ballads'],
      French: ['French sad chanson'],
      English: ['sad acoustic songs', 'breakup ballads'],
    },
  },
  {
    id: 'sleep',
    label: 'Sleep',
    description: 'Drift off slowly',
    icon: Moon,
    gradient: 'from-indigo-500 to-violet-700',
    queries: {
      Hindi: ['Hindi soft sleep music'],
      Punjabi: ['Punjabi soft melodies'],
      Korean: ['K-Pop sleep ballads'],
      Spanish: ['Spanish soft acoustic'],
      Japanese: ['J-Pop sleep music'],
      French: ['French soft acoustic'],
      English: ['sleep ambient music', 'soft piano sleep'],
    },
  },
  {
    id: 'morning',
    label: 'Morning',
    description: 'Sunny start',
    icon: Sun,
    gradient: 'from-yellow-400 to-amber-500',
    queries: {
      Hindi: ['Bollywood morning fresh'],
      Punjabi: ['Punjabi fresh morning'],
      Korean: ['K-Pop bright morning'],
      Spanish: ['Spanish bright morning'],
      Japanese: ['J-Pop morning fresh'],
      French: ['French morning fresh'],
      English: ['morning fresh pop', 'sunny pop hits'],
    },
  },
  {
    id: 'driving',
    label: 'Driving',
    description: 'Open-road tracks',
    icon: Flame,
    gradient: 'from-orange-500 to-red-500',
    queries: {
      Hindi: ['Bollywood road trip', 'Hindi driving songs'],
      Punjabi: ['Punjabi road trip', 'AP Dhillon driving'],
      Korean: ['K-Pop driving tracks'],
      Spanish: ['Latin road trip', 'reggaeton driving'],
      Japanese: ['J-Pop driving'],
      French: ['French driving tracks'],
      English: ['road trip rock pop', 'driving hits'],
    },
  },
];

const COUNTRY_BY_LANGUAGE: Record<string, string> = {
  Hindi: 'in',
  Punjabi: 'in',
  Tamil: 'in',
  Telugu: 'in',
  Korean: 'kr',
  Spanish: 'mx',
  Japanese: 'jp',
  French: 'fr',
  English: 'us',
};

export function MoodView({ preferredLanguages, onPlaySong, onLikeSong, likedSongIds }: MoodViewProps) {
  const [selectedMoodId, setSelectedMoodId] = useState<string | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const primaryLanguage = preferredLanguages[0] ?? 'English';
  const country = COUNTRY_BY_LANGUAGE[primaryLanguage] ?? '';

  const selectedMood = useMemo(
    () => MOODS.find((m) => m.id === selectedMoodId) ?? null,
    [selectedMoodId],
  );

  useEffect(() => {
    if (!selectedMood) {
      setSongs([]);
      setError('');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError('');
    setSongs([]);

    const queries = selectedMood.queries[primaryLanguage] ?? selectedMood.queries.English;

    Promise.all(queries.slice(0, 3).map((q) => searchSongsOnline(q, 6, country)))
      .then((results) => {
        if (cancelled) return;
        const merged: Song[] = [];
        const seen = new Set<string>();
        results.forEach((r) => {
          (r.data ?? []).forEach((song) => {
            if (seen.has(song.id)) return;
            seen.add(song.id);
            merged.push(song);
          });
        });
        if (merged.length === 0) {
          setError('No songs found for this mood right now. Try another one.');
        }
        setSongs(merged.slice(0, 18));
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load mood songs. Please try again.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMood, primaryLanguage, country]);

  const songsWithLikedState = useMemo(
    () => songs.map((song) => ({ ...song, isLiked: likedSongIds.has(song.id) })),
    [songs, likedSongIds],
  );

  return (
    <div className="space-y-12">
      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Pick a mood</p>
        <h2 className="mb-8 text-4xl tracking-tight">Music by mood</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {MOODS.map((mood) => {
            const Icon = mood.icon;
            const isActive = mood.id === selectedMoodId;
            return (
              <motion.button
                key={mood.id}
                type="button"
                onClick={() => setSelectedMoodId(isActive ? null : mood.id)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all ${
                  isActive ? 'ring-2 ring-accent shadow-2xl' : 'hover:shadow-xl'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${mood.gradient} opacity-95`} />
                <div className="absolute inset-0 bg-black/10" />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-medium text-white">{mood.label}</p>
                    <p className="mt-1 text-xs text-white/85">{mood.description}</p>
                  </div>
                  <div className="rounded-full bg-white/20 p-2 backdrop-blur-sm">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedMood && (
          <motion.section
            key={selectedMood.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {selectedMood.label} mix
                </p>
                <h3 className="text-2xl tracking-tight">
                  Tracks for when you feel {selectedMood.label.toLowerCase()}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                {primaryLanguage}
              </div>
            </div>

            {error && !isLoading && (
              <p className="text-sm text-amber-400">{error}</p>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="space-y-3">
                    <Skeleton className="aspect-square w-full rounded-2xl" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : songsWithLikedState.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8">
                {songsWithLikedState.map((song) => (
                  <SongCard key={song.id} song={song} onPlay={onPlaySong} onLike={onLikeSong} />
                ))}
              </div>
            ) : !error ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/30 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4" />
                Pick a mood to load tracks.
              </div>
            ) : null}
          </motion.section>
        )}

        {!selectedMood && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-border bg-secondary/30 p-8 text-sm text-muted-foreground"
          >
            Tap any mood above to spin up a fresh playlist tuned to your preferred language.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

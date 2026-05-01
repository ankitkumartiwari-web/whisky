import { Play, Heart, Download, Check } from 'lucide-react';
import { Song } from '../data/mockData';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Skeleton } from 'boneyard-js/react';
import { Skeleton as UiSkeleton } from './ui/skeleton';
import { isValidYouTubeVideoId } from '../lib/playerDiagnostics';
import { isSongSaved, removeSongOffline, saveSongOffline } from '../lib/offlineStore';

interface SongCardProps {
  song: Song;
  onPlay?: (song: Song) => void;
  onLike?: (songId: string) => void;
  isLoading?: boolean;
}

export function SongCard(props: SongCardProps) {
  const { song, onPlay, onLike, isLoading } = props;
  const [isHovered, setIsHovered] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSavingState, setIsSavingState] = useState<'idle' | 'busy'>('idle');
  const loading = typeof isLoading === 'boolean' ? isLoading : false;
  const isPlayable = isValidYouTubeVideoId(song.videoId);

  useEffect(() => {
    let cancelled = false;
    isSongSaved(song.id).then((saved) => {
      if (!cancelled) setIsSaved(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [song.id]);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike?.(song.id);
  };

  const handleSaveOffline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSavingState === 'busy') return;
    setIsSavingState('busy');
    try {
      if (isSaved) {
        await removeSongOffline(song.id);
        setIsSaved(false);
      } else {
        await saveSongOffline(song);
        setIsSaved(true);
      }
      window.dispatchEvent(new CustomEvent('whisky:saved-songs-changed'));
    } finally {
      setIsSavingState('idle');
    }
  };

  const handlePlay = () => {
    onPlay?.(song);
  };

  if (loading) {
    return (
      <div className="relative group" aria-busy="true" aria-label="Loading song card">
        <div className="relative overflow-hidden aspect-square mb-4 rounded-3xl bg-white/5 border border-white/10">
          <UiSkeleton className="absolute inset-0 rounded-3xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          <div className="absolute top-4 right-4">
            <UiSkeleton className="w-5 h-5 rounded-full" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <UiSkeleton className="w-16 h-16 rounded-full" />
          </div>
        </div>
        <div className="mt-1 space-y-3 px-1 min-h-[72px] rounded-2xl border border-white/5 bg-white/5 p-3">
          <UiSkeleton className="h-4 w-11/12 rounded-full bg-white/25 dark:bg-white/25" />
          <UiSkeleton className="h-3 w-4/5 rounded-full bg-white/18 dark:bg-white/18" />
          <div className="flex items-center gap-2 pt-1">
            <UiSkeleton className="h-3 w-20 rounded-full bg-white/14 dark:bg-white/14" />
            <UiSkeleton className="h-3 w-12 rounded-full bg-white/14 dark:bg-white/14" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Skeleton name="song-card" loading={loading}>
      <motion.div
        className="relative group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handlePlay}
        whileHover={{ y: -8 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="relative overflow-hidden aspect-square mb-4 rounded-3xl">
          <img
            src={song.coverUrl}
            alt={song.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.button
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl ${
                isPlayable
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-white/20 text-white'
              }`}
              onClick={handlePlay}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: isHovered ? 1 : 0.8, 
                opacity: isHovered ? 1 : 0 
              }}
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
              title={isPlayable ? 'Play song' : 'This result is not wired to a playable source yet'}
            >
              <Play className="w-7 h-7 fill-current ml-0.5" />
            </motion.button>
          </motion.div>
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <motion.button
              className={`transition-all ${
                isSaved
                  ? 'opacity-100 text-emerald-400'
                  : 'opacity-0 group-hover:opacity-100 text-white'
              }`}
              onClick={handleSaveOffline}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              title={isSaved ? 'Remove from offline' : 'Save for offline'}
              disabled={isSavingState === 'busy'}
            >
              {isSaved ? <Check className="w-5 h-5" /> : <Download className="w-5 h-5" />}
            </motion.button>
            <motion.button
              className={`transition-all ${
                song.isLiked ? 'opacity-100 text-accent' : 'opacity-0 group-hover:opacity-100 text-white'
              }`}
              onClick={handleLike}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            >
              <Heart className={`w-5 h-5 ${song.isLiked ? 'fill-current' : ''}`} />
            </motion.button>
          </div>
        </div>
        <div className="space-y-1 px-1">
          <h3 className="text-sm truncate">{song.title}</h3>
          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
          {!isPlayable && !loading && (
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-400/80">
              Preview only
            </p>
          )}
        </div>
      </motion.div>
    </Skeleton>
  );
}

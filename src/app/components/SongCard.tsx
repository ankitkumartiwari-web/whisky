import { Play, Heart } from 'lucide-react';
import { Song } from '../data/mockData';
import { useState } from 'react';
import { motion } from 'motion/react';
import { Skeleton } from 'boneyard-js/react';
import { Skeleton as UiSkeleton } from './ui/skeleton';
import { isValidYouTubeVideoId } from '../lib/playerDiagnostics';

interface SongCardProps {
  song: Song;
  onPlay?: (song: Song) => void;
  onLike?: (songId: string) => void;
  isLoading?: boolean;
}

export function SongCard(props: SongCardProps) {
  const { song, onPlay, onLike, isLoading } = props;
  const [isHovered, setIsHovered] = useState(false);
  const loading = typeof isLoading === 'boolean' ? isLoading : false;
  const isPlayable = isValidYouTubeVideoId(song.videoId);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike?.(song.id);
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
        <div className="space-y-2 px-1">
          <UiSkeleton className="h-4 w-3/4 rounded-md" />
          <UiSkeleton className="h-3 w-1/2 rounded-md" />
          <UiSkeleton className="h-3 w-24 rounded-md" />
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
              title={isPlayable ? 'Play song' : 'This result is not wired to a playable YouTube source yet'}
            >
              <Play className="w-7 h-7 fill-current ml-0.5" />
            </motion.button>
          </motion.div>
          <motion.button
            className={`absolute top-4 right-4 transition-all ${
              song.isLiked ? 'opacity-100 text-accent' : 'opacity-0 group-hover:opacity-100 text-white'
            }`}
            onClick={handleLike}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
          >
            <Heart className={`w-5 h-5 ${song.isLiked ? 'fill-current' : ''}`} />
          </motion.button>
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

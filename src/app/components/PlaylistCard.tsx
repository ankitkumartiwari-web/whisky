import { Play } from 'lucide-react';
import { Playlist } from '../data/mockData';
import { useState } from 'react';
import { motion } from 'motion/react';

interface PlaylistCardProps {
  playlist: Playlist;
  onPlay?: (playlist: Playlist) => void;
}

export function PlaylistCard({ playlist, onPlay }: PlaylistCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handlePlay = () => {
    onPlay?.(playlist);
  };

  return (
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
          src={playlist.coverUrl}
          alt={playlist.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.button
            className="w-16 h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-2xl"
            onClick={(e) => {
              e.stopPropagation();
              handlePlay();
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: isHovered ? 1 : 0.8, 
              opacity: isHovered ? 1 : 0 
            }}
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2 }}
          >
            <Play className="w-7 h-7 fill-current ml-0.5" />
          </motion.button>
        </motion.div>
      </div>
      <div className="space-y-1 px-1">
        <h3 className="text-sm truncate">{playlist.name}</h3>
        <p className="text-xs text-muted-foreground truncate">
          {playlist.songCount} tracks
        </p>
      </div>
    </motion.div>
  );
}

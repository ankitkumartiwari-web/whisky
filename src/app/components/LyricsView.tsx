import { X, Music2 } from 'lucide-react';
import { Song } from '../data/mockData';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';

interface LyricsViewProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  isPlaying: boolean;
  progress: number;
}

interface LyricLine {
  time: number;
  text: string;
}

const mockLyrics: LyricLine[] = [
  { time: 0, text: "In the silence of the night" },
  { time: 5, text: "Stars are shining bright" },
  { time: 10, text: "Music fills the air" },
  { time: 15, text: "Taking me somewhere" },
  { time: 20, text: "" },
  { time: 22, text: "Lost in melodies divine" },
  { time: 27, text: "Every beat is mine" },
  { time: 32, text: "Rhythm in my soul" },
  { time: 37, text: "Music makes me whole" },
  { time: 42, text: "" },
  { time: 45, text: "Dancing through the sound" },
  { time: 50, text: "Feet off the ground" },
  { time: 55, text: "Floating on a dream" },
  { time: 60, text: "Nothing's as it seems" },
  { time: 65, text: "" },
  { time: 67, text: "Let the music play" },
  { time: 72, text: "Take my breath away" },
  { time: 77, text: "In this moment here" },
  { time: 82, text: "Everything is clear" },
  { time: 87, text: "" },
  { time: 90, text: "Waves of harmony" },
  { time: 95, text: "Setting my heart free" },
  { time: 100, text: "Notes that never end" },
  { time: 105, text: "Music is my friend" },
];

export function LyricsView({ song, isOpen, onClose, isPlaying, progress }: LyricsViewProps) {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  useEffect(() => {
    if (!song || !isPlaying) return;
    
    const currentTime = (progress / 100) * song.duration;
    
    // Find the current lyric line based on time
    let lineIndex = 0;
    for (let i = mockLyrics.length - 1; i >= 0; i--) {
      if (currentTime >= mockLyrics[i].time) {
        lineIndex = i;
        break;
      }
    }
    
    setCurrentLineIndex(lineIndex);
  }, [progress, song, isPlaying]);

  if (!song) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-background z-50 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Background Gradient */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              background: `radial-gradient(circle at 50% 20%, var(--accent) 0%, transparent 70%)`
            }}
          />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-8 right-8 z-10 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Content */}
          <div className="relative h-full flex flex-col items-center justify-center px-12">
            {/* Song Info */}
            <motion.div
              className="mb-16 text-center"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="w-32 h-32 rounded-3xl overflow-hidden mx-auto mb-6 shadow-2xl">
                <img
                  src={song.coverUrl}
                  alt={song.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <h2 className="text-3xl mb-2">{song.title}</h2>
              <p className="text-lg text-muted-foreground">{song.artist}</p>
            </motion.div>

            {/* Lyrics */}
            <div className="max-w-3xl w-full">
              <div className="space-y-6 text-center">
                {mockLyrics.map((line, index) => {
                  const isActive = index === currentLineIndex;
                  const isPast = index < currentLineIndex;
                  const isFuture = index > currentLineIndex;
                  
                  return (
                    <motion.div
                      key={index}
                      className={`transition-all duration-500 ${
                        isActive
                          ? 'text-4xl text-accent scale-110'
                          : isPast
                          ? 'text-2xl text-muted-foreground/40'
                          : 'text-2xl text-muted-foreground/60'
                      }`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{
                        opacity: line.text ? 1 : 0,
                        y: 0,
                        scale: isActive ? 1.1 : 1,
                      }}
                      transition={{ delay: index * 0.05 }}
                    >
                      {line.text || (
                        <span className="inline-block">
                          <Music2 className="w-6 h-6 opacity-20" />
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Hint */}
            <motion.div
              className="absolute bottom-12 text-center text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <p>Lyrics sync with your music</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

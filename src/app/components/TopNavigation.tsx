import { Search, Moon, Sun, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import type { Song } from '../data/mockData';

export type ContentLanguage = 'English' | 'Hindi';

interface TopNavigationProps {
  displayName: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  suggestions?: Song[];
  isSuggestionsLoading?: boolean;
  onSuggestionPick?: (song: Song) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'JD';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function TopNavigation({
  displayName,
  searchQuery,
  onSearchChange,
  suggestions = [],
  isSuggestionsLoading = false,
  onSuggestionPick,
}: TopNavigationProps) {
  const { theme, toggleTheme } = useTheme();
  const initials = getInitials(displayName);
  const searchHint = searchQuery.trim()
    ? `Recommendations for "${searchQuery.trim()}" will appear below.`
    : 'Type a song name to see recommendations.';

  const [hasFocus, setHasFocus] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close the suggestions panel when the user clicks anywhere outside the search.
  useEffect(() => {
    if (!hasFocus) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setHasFocus(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [hasFocus]);

  const trimmed = searchQuery.trim();
  const showSuggestions = hasFocus && trimmed.length > 0;
  const topSuggestions = suggestions.slice(0, 6);

  return (
    <div className="fixed top-0 left-20 right-0 bg-background/60 backdrop-blur-xl border-b border-border z-40">
      {/* Right padding clears the Windows titleBarOverlay (~138px of min/max/close). */}
      <div className="pl-12 pr-[160px] py-6 flex items-center justify-between">
        {/* Search Bar */}
        <div className="flex-1 max-w-2xl" ref={wrapperRef}>
          <div className="space-y-2 relative">
            <div className="relative group bg-secondary/50 rounded-full px-6 py-3 transition-all hover:bg-secondary">
              <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                onFocus={() => setHasFocus(true)}
                placeholder="Search for songs, artists, playlists..."
                className="w-full bg-transparent pl-8 pr-10 text-sm focus:outline-none placeholder:text-muted-foreground"
              />
              {isSuggestionsLoading && trimmed.length > 0 && (
                <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
              )}
            </div>
            <p className="px-6 text-xs text-muted-foreground">
              {searchHint}
            </p>

            <AnimatePresence>
              {showSuggestions && (topSuggestions.length > 0 || isSuggestionsLoading) && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
                >
                  {topSuggestions.length === 0 && isSuggestionsLoading && (
                    <div className="px-5 py-4 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Searching...
                    </div>
                  )}
                  {topSuggestions.map((song) => (
                    <button
                      key={song.id}
                      type="button"
                      onMouseDown={(e) => {
                        // mouseDown beats blur — input loses focus right after but the
                        // click still fires on the right element.
                        e.preventDefault();
                        if (onSuggestionPick) onSuggestionPick(song);
                        setHasFocus(false);
                      }}
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/70 transition-colors"
                    >
                      <img
                        src={song.coverUrl}
                        alt=""
                        className="w-9 h-9 rounded-md object-cover flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{song.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-6">
          {/* Theme Toggle */}
          <motion.button
            onClick={toggleTheme}
            className="p-3 rounded-full bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            aria-label="Toggle theme"
            whileHover={{ scale: 1.1, rotate: 15 }}
            whileTap={{ scale: 0.95 }}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </motion.button>

          {/* User Initial */}
          <motion.div
            className="w-11 h-11 rounded-full bg-gradient-to-br from-accent to-accent/70 text-accent-foreground flex items-center justify-center text-sm font-medium shadow-lg"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title={displayName}
          >
            {initials}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

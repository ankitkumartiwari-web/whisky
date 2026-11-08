import { Search, Moon, Sun, Loader2, Clock, X, Play } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import type { Song } from '../data/mockData';

export type ContentLanguage = 'English' | 'Hindi';

const SEARCH_HISTORY_KEY = 'whisky-search-history';
const MAX_SEARCH_HISTORY = 8;
const MAX_MATCHING_HISTORY = 4;

function readSearchHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, MAX_SEARCH_HISTORY);
  } catch {
    return [];
  }
}

function writeSearchHistory(items: string[]) {
  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items));
  } catch {
    // Storage can be unavailable (private mode / quota) — history is best-effort.
  }
}

interface TopNavigationProps {
  displayName: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  suggestions?: Song[];
  isSuggestionsLoading?: boolean;
  onSuggestionPick?: (song: Song) => void;
  recentSongs?: Song[];
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
  recentSongs = [],
}: TopNavigationProps) {
  const { theme, toggleTheme } = useTheme();
  const initials = getInitials(displayName);
  const searchHint = searchQuery.trim()
    ? `Recommendations for "${searchQuery.trim()}" will appear below.`
    : 'Type a song name to see recommendations.';

  const [hasFocus, setHasFocus] = useState(false);
  const [history, setHistory] = useState<string[]>(readSearchHistory);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close the suggestions panel when the user clicks anywhere outside the search.
  useEffect(() => {
    if (!hasFocus) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setHasFocus(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [hasFocus]);

  const trimmed = searchQuery.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  const historyMatches = (
    trimmed
      ? history.filter((item) => item.toLowerCase().includes(lowerTrimmed))
      : history
  ).slice(0, trimmed ? MAX_MATCHING_HISTORY : MAX_SEARCH_HISTORY);

  const songMatches = trimmed ? suggestions.slice(0, 6) : recentSongs.slice(0, 5);
  const totalRows = historyMatches.length + songMatches.length;
  const showPanel =
    hasFocus &&
    (totalRows > 0 || (isSuggestionsLoading && trimmed.length > 0));

  const rememberSearch = (term: string) => {
    const value = term.trim();
    if (!value) return;
    setHistory((prev) => {
      const next = [
        value,
        ...prev.filter((item) => item.toLowerCase() !== value.toLowerCase()),
      ].slice(0, MAX_SEARCH_HISTORY);
      writeSearchHistory(next);
      return next;
    });
  };

  const removeHistoryItem = (term: string) => {
    setHistory((prev) => {
      const next = prev.filter((item) => item !== term);
      writeSearchHistory(next);
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    writeSearchHistory([]);
  };

  const applyHistory = (term: string) => {
    rememberSearch(term);
    onSearchChange(term);
    setHasFocus(false);
    setActiveIndex(-1);
  };

  const pickSong = (song: Song) => {
    if (trimmed) rememberSearch(trimmed);
    if (onSuggestionPick) onSuggestionPick(song);
    setHasFocus(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && totalRows > 0) {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % totalRows);
      return;
    }
    if (event.key === 'ArrowUp' && totalRows > 0) {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + totalRows) % totalRows);
      return;
    }
    if (event.key === 'Escape') {
      setHasFocus(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && activeIndex < totalRows) {
        if (activeIndex < historyMatches.length) {
          applyHistory(historyMatches[activeIndex]);
        } else {
          const song = songMatches[activeIndex - historyMatches.length];
          if (song) pickSong(song);
        }
        return;
      }
      rememberSearch(trimmed);
      setHasFocus(false);
      setActiveIndex(-1);
    }
  };

  let rowIndex = 0;

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
                onChange={(event) => {
                  setActiveIndex(-1);
                  onSearchChange(event.target.value);
                }}
                onFocus={() => setHasFocus(true)}
                onKeyDown={handleKeyDown}
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
              {showPanel && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full left-0 right-0 mt-2 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl"
                >
                  {historyMatches.length > 0 && (
                    <div className="py-1">
                      <div className="flex items-center justify-between px-4 pt-2 pb-1">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {trimmed ? 'Search history' : 'Recent searches'}
                        </p>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={clearHistory}
                          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Clear all
                        </button>
                      </div>
                      {historyMatches.map((term) => {
                        const index = rowIndex++;
                        const isActive = index === activeIndex;
                        return (
                          <div
                            key={`history-${term}`}
                            className={`group flex items-center gap-3 px-4 py-2 transition-colors ${
                              isActive ? 'bg-secondary' : 'hover:bg-secondary/70'
                            }`}
                          >
                            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => applyHistory(term)}
                              className="min-w-0 flex-1 text-left text-sm truncate"
                            >
                              {term}
                            </button>
                            <button
                              type="button"
                              title={`Remove "${term}" from history`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => removeHistoryItem(term)}
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {songMatches.length > 0 && (
                    <div className={`py-1 ${historyMatches.length > 0 ? 'border-t border-border' : ''}`}>
                      <p className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {trimmed ? 'Songs' : 'Recently played'}
                      </p>
                      {songMatches.map((song) => {
                        const index = rowIndex++;
                        const isActive = index === activeIndex;
                        return (
                          <button
                            key={song.id}
                            type="button"
                            onMouseDown={(e) => {
                              // mouseDown beats blur — input loses focus right after but the
                              // click still fires on the right element.
                              e.preventDefault();
                              pickSong(song);
                            }}
                            className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${
                              isActive ? 'bg-secondary' : 'hover:bg-secondary/70'
                            }`}
                          >
                            {song.coverUrl ? (
                              <img
                                src={song.coverUrl}
                                alt=""
                                className="w-9 h-9 rounded-md object-cover flex-shrink-0"
                              />
                            ) : (
                              <span className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                                <Play className="w-4 h-4 text-muted-foreground" />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm truncate">{song.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {trimmed && isSuggestionsLoading && songMatches.length === 0 && (
                    <div className="px-5 py-4 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Searching...
                    </div>
                  )}
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

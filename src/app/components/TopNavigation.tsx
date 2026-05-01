import { Search, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'motion/react';

export type ContentLanguage = 'English' | 'Hindi';

interface TopNavigationProps {
  displayName: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
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
}: TopNavigationProps) {
  const { theme, toggleTheme } = useTheme();
  const initials = getInitials(displayName);
  const searchHint = searchQuery.trim()
    ? `Recommendations for "${searchQuery.trim()}" will appear below.`
    : 'Type a song name to see recommendations.';

  return (
    <div className="fixed top-0 left-20 right-0 bg-background/60 backdrop-blur-xl border-b border-border z-40">
      <div className="px-12 py-6 flex items-center justify-between">
        {/* Search Bar */}
        <div className="flex-1 max-w-2xl">
          <div className="space-y-2">
            <div className="relative group bg-secondary/50 rounded-full px-6 py-3 transition-all hover:bg-secondary">
              <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search for songs, artists, playlists..."
                className="w-full bg-transparent pl-8 text-sm focus:outline-none placeholder:text-muted-foreground"
              />
            </div>
            <p className="px-6 text-xs text-muted-foreground">
              {searchHint}
            </p>
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

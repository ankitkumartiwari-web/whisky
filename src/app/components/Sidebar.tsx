import {
  Home,
  Compass,
  Library,
  ListMusic,
  Heart,
  Users,
  Music,
  Disc3,
} from 'lucide-react';
import { motion } from 'motion/react';

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

const menuItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'search', label: 'Explore', icon: Compass },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'liked', label: 'Liked Songs', icon: Heart },
  { id: 'ai-dj', label: 'Collab Listeners', icon: Users },
  { id: 'mood', label: 'Mood Music', icon: Music },
];

export function Sidebar({ activeItem, onItemClick }: SidebarProps) {
  return (
    <div className="fixed left-0 top-0 bottom-0 w-20 bg-sidebar border-r border-border flex flex-col items-center py-8">
      {/* Logo */}
      <motion.div 
        className="mb-12"
        whileHover={{ rotate: 180 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      >
        <div className="relative">
          <Disc3 className="w-10 h-10 text-accent" />
        </div>
      </motion.div>

      {/* Navigation */}
      <nav className="flex-1">
        <ul className="space-y-8">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            return (
              <li key={item.id}>
                <motion.button
                  onClick={() => onItemClick(item.id)}
                  className={`relative group flex flex-col items-center gap-1 transition-colors ${
                    isActive
                      ? 'text-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={item.label}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="w-6 h-6" />
                  {isActive && (
                    <motion.div
                      className="absolute -left-10 top-1/2 -translate-y-1/2 w-1 h-10 bg-accent rounded-full"
                      layoutId="activeIndicator"
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    />
                  )}
                </motion.button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Home,
  Library,
  ListMusic,
  Users,
  Music,
  Disc3,
  Plus,
  Heart,
  Mic2,
  Pause,
  Sparkles,
  Download,
  BarChart3,
  X,
  type LucideIcon,
} from 'lucide-react';
import { motion, Reorder } from 'motion/react';
import { WIDGET_REGISTRY } from './widgets/widgetRegistry';

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  onAddWidget: () => void;
  onRemoveWidget: (id: string) => void;
  activeWidgetIds: string[];
}

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  isWidget?: boolean;
}

const BUILTIN_ITEMS: MenuItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'ai-dj', label: 'Collab Listeners', icon: Users },
  { id: 'mood', label: 'Mood Music', icon: Music },
];

const WIDGET_ICON_BY_KEY: Record<string, LucideIcon> = {
  'now-playing': Pause,
  recent: Music,
  'top-artists': Mic2,
  mood: Sparkles,
  liked: Heart,
  curator: Sparkles,
  downloads: Download,
  stats: BarChart3,
};

const SIDEBAR_ORDER_KEY = 'whisky-sidebar-order';

function getStoredOrder(allIds: string[]): string[] {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_ORDER_KEY);
    if (!raw) return allIds;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return allIds;
    const cleaned = parsed.filter((id) => typeof id === 'string' && allIds.includes(id));
    allIds.forEach((id) => {
      if (!cleaned.includes(id)) cleaned.push(id);
    });
    return cleaned;
  } catch {
    return allIds;
  }
}

export function Sidebar({ activeItem, onItemClick, onAddWidget, onRemoveWidget, activeWidgetIds }: SidebarProps) {
  const widgetItems: MenuItem[] = useMemo(() => {
    return activeWidgetIds
      .map((id) => {
        const def = WIDGET_REGISTRY.find((w) => w.id === id);
        if (!def) return null;
        const icon = WIDGET_ICON_BY_KEY[def.iconKey] ?? Sparkles;
        return { id, label: def.title, icon, isWidget: true };
      })
      .filter((m): m is MenuItem => Boolean(m));
  }, [activeWidgetIds]);

  const allItems = useMemo(() => [...BUILTIN_ITEMS, ...widgetItems], [widgetItems]);
  const allIds = useMemo(() => allItems.map((item) => item.id), [allItems]);

  const [order, setOrder] = useState<string[]>(() => getStoredOrder(allIds));

  useEffect(() => {
    setOrder((prev) => {
      const cleaned = prev.filter((id) => allIds.includes(id));
      allIds.forEach((id) => {
        if (!cleaned.includes(id)) cleaned.push(id);
      });
      return cleaned;
    });
  }, [allIds]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(order));
  }, [order]);

  const itemsById = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems]);

  return (
    <div className="fixed left-0 top-0 bottom-0 w-20 bg-sidebar border-r border-border flex flex-col items-center py-8">
      <motion.div
        className="mb-12"
        whileHover={{ rotate: 180 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      >
        <div className="relative">
          <Disc3 className="w-10 h-10 text-accent" />
        </div>
      </motion.div>

      <nav className="flex-1 w-full overflow-y-auto px-2 custom-scrollbar">
        <Reorder.Group
          axis="y"
          values={order}
          onReorder={setOrder}
          className="flex flex-col items-center gap-6 list-none m-0 p-0"
        >
          {order.map((id) => {
            const item = itemsById.get(id);
            if (!item) return null;
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            return (
              <Reorder.Item
                key={id}
                value={id}
                whileDrag={{ scale: 1.15, zIndex: 50 }}
                className="cursor-grab active:cursor-grabbing select-none"
              >
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => onItemClick(item.id)}
                    className={`relative flex flex-col items-center gap-1 transition-colors ${
                      isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-6 h-6" />
                    {isActive && (
                      <motion.div
                        className="absolute -left-10 top-1/2 -translate-y-1/2 w-1 h-10 bg-accent rounded-full"
                        layoutId="activeIndicator"
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      />
                    )}
                  </button>
                  {item.isWidget && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveWidget(item.id);
                      }}
                      className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md hover:text-destructive group-hover:flex"
                      title={`Remove ${item.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </nav>

      <motion.button
        onClick={onAddWidget}
        className={`mb-2 mt-4 flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors ${
          activeItem === 'manage-widgets'
            ? 'border-accent bg-accent text-accent-foreground'
            : 'border-border bg-secondary text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
        }`}
        title="Manage widgets"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
      >
        <Plus className="h-5 w-5" />
      </motion.button>
    </div>
  );
}

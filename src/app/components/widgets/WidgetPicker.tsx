import { motion, AnimatePresence } from 'motion/react';
import { Check, Heart, Mic2, Music, Pause, Plus, Sparkles, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { WIDGET_REGISTRY } from './widgetRegistry';

interface WidgetPickerProps {
  isOpen: boolean;
  activeWidgetIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}

const ICON_MAP = {
  'now-playing': Pause,
  recent: Music,
  'top-artists': Mic2,
  mood: Sparkles,
  liked: Heart,
  curator: Sparkles,
} as const;

export function WidgetPicker({ isOpen, activeWidgetIds, onToggle, onClose }: WidgetPickerProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const panelBg = isDark ? '#0d0d10' : '#ffffff';
  const cardBg = isDark ? '#16161a' : '#f5f5f7';
  const cardActiveBg = isDark ? '#1a2920' : '#e8f5ee';
  const text = isDark ? '#f4f4f5' : '#0a0a0a';
  const subtle = isDark ? 'rgba(244,244,245,0.65)' : 'rgba(10,10,10,0.6)';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-3xl p-8 shadow-2xl"
            style={{ backgroundColor: panelBg, color: text, border: `1px solid ${borderCol}` }}
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em]" style={{ color: subtle }}>Personalize</p>
                <h2 className="text-2xl tracking-tight" style={{ color: text }}>Add widgets</h2>
                <p className="mt-1 text-sm" style={{ color: subtle }}>
                  Pick the widgets you want pinned to the right. You can toggle them anytime.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2"
                style={{ color: subtle }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {WIDGET_REGISTRY.map((widget) => {
                const Icon = ICON_MAP[widget.iconKey] ?? Sparkles;
                const isActive = activeWidgetIds.includes(widget.id);
                return (
                  <button
                    key={widget.id}
                    type="button"
                    onClick={() => onToggle(widget.id)}
                    className="flex items-start gap-3 rounded-2xl p-4 text-left transition-all"
                    style={{
                      backgroundColor: isActive ? cardActiveBg : cardBg,
                      border: `1px solid ${isActive ? 'var(--accent)' : borderCol}`,
                      color: text,
                    }}
                  >
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: isActive ? 'var(--accent)' : panelBg,
                        color: isActive ? '#0a0a0a' : text,
                      }}
                    >
                      {isActive ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: text }}>{widget.title}</p>
                      <p className="mt-0.5 text-xs" style={{ color: subtle }}>{widget.description}</p>
                    </div>
                    {!isActive && <Plus className="h-4 w-4 flex-shrink-0" style={{ color: subtle }} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { ChevronRight, LayoutPanelLeft } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { WIDGET_REGISTRY } from './widgetRegistry';
import type { WidgetContext } from './widgetTypes';

interface WidgetDockProps {
  activeWidgetIds: string[];
  onReorder: (next: string[]) => void;
  onRemove: (id: string) => void;
  ctx: WidgetContext;
}

export function WidgetDock({ activeWidgetIds, onReorder, onRemove, ctx }: WidgetDockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const dockBg = isDark ? '#0d0d10' : '#fafafa';
  const subtle = isDark ? 'rgba(244,244,245,0.65)' : 'rgba(10,10,10,0.6)';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const widgets = activeWidgetIds
    .map((id) => WIDGET_REGISTRY.find((w) => w.id === id))
    .filter((w): w is (typeof WIDGET_REGISTRY)[number] => Boolean(w));

  if (widgets.length === 0) return null;

  return (
    <motion.aside
      initial={{ x: -32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed left-20 top-28 bottom-28 z-40 w-[280px] overflow-y-auto px-3 py-3"
      style={{ backgroundColor: dockBg, borderRight: `1px solid ${borderCol}` }}
    >
      <div
        className="mb-3 flex items-center justify-between px-1"
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em]" style={{ color: subtle }}>
          <LayoutPanelLeft className="h-3 w-3" />
          Widgets
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-full p-1"
          style={{ color: subtle }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <motion.span animate={{ rotate: collapsed ? 180 : 0 }}>
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.span>
        </button>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Reorder.Group
              axis="y"
              values={activeWidgetIds}
              onReorder={onReorder}
              className="flex flex-col gap-3 list-none m-0 p-0"
            >
              {widgets.map((widget) => {
                const W = widget.Component;
                return (
                  <Reorder.Item
                    key={widget.id}
                    value={widget.id}
                    whileDrag={{ scale: 1.03, zIndex: 5 }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <W ctx={ctx} onRemove={() => onRemove(widget.id)} />
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}

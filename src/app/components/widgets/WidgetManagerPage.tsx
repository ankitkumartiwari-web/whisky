import { Check, Heart, Mic2, Music, Pause, Plus, Sparkles } from 'lucide-react';
import { WIDGET_REGISTRY } from './widgetRegistry';

interface WidgetManagerPageProps {
  activeWidgetIds: string[];
  onToggle: (id: string) => void;
}

const ICON_MAP = {
  'now-playing': Pause,
  recent: Music,
  'top-artists': Mic2,
  mood: Sparkles,
  liked: Heart,
  curator: Sparkles,
} as const;

export function WidgetManagerPage({ activeWidgetIds, onToggle }: WidgetManagerPageProps) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Personalize</p>
        <h2 className="text-4xl tracking-tight">Manage widgets</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Each widget you add becomes its own icon in the left sidebar. Tap to toggle. Drag the sidebar
          icons to reorder.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {WIDGET_REGISTRY.map((widget) => {
          const Icon = ICON_MAP[widget.iconKey] ?? Sparkles;
          const isActive = activeWidgetIds.includes(widget.id);
          return (
            <button
              key={widget.id}
              type="button"
              onClick={() => onToggle(widget.id)}
              className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-all ${
                isActive
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-secondary/40 hover:border-accent/40 hover:bg-secondary/70'
              }`}
            >
              <div
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${
                  isActive ? 'bg-accent text-accent-foreground' : 'bg-background text-foreground'
                }`}
              >
                {isActive ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium">{widget.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{widget.description}</p>
                <p className={`mt-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] ${
                  isActive ? 'text-accent' : 'text-muted-foreground'
                }`}>
                  {isActive ? <><Check className="h-3 w-3" /> Added</> : <><Plus className="h-3 w-3" /> Add</>}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

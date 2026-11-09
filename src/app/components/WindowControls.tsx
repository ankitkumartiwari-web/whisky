import { useEffect, useState } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const yesControls =
    typeof window !== 'undefined' && window.whiskyDesktop?.platform === 'win32'
      ? window.whiskyDesktop.windowControls
      : undefined;

  useEffect(() => {
    const controls = window.whiskyDesktop?.windowControls;
    if (!controls) return;
    let active = true;
    void controls
      .isMaximized()
      .then((value) => {
        if (active) setIsMaximized(value);
      })
      .catch(() => {
        /* ignore */
      });
    const dispose = controls.onMaximizedChange((value) => setIsMaximized(value));
    return () => {
      active = false;
      dispose();
    };
  }, []);

  if (!yesControls) return null;

  const buttonBase =
    'flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors';

  return (
    <div className="app-region-no-drag ml-1 flex items-center gap-1 rounded-full border border-border/60 bg-secondary/40 p-1 shadow-soft">
      <button
        type="button"
        title="Minimize"
        aria-label="Minimize window"
        onClick={() => yesControls.minimize()}
        className={`${buttonBase} hover:bg-secondary/90 hover:text-foreground`}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        onClick={() => yesControls.toggleMaximize()}
        className={`${buttonBase} hover:bg-secondary/90 hover:text-foreground`}
      >
        {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        title="Close"
        aria-label="Close window"
        onClick={() => yesControls.close()}
        className={`${buttonBase} hover:bg-rose-500 hover:text-white`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

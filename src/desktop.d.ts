interface Window {
  __WHISKY_DESKTOP__?: boolean;
  __WHISKY_PLATFORM__?: string;
  whiskyDesktop?: {
    platform?: string;
    windowControls?: {
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
    };
    startup?: {
      retry: () => void;
    };
    clipboard?: {
      writeText: (text: string) => Promise<boolean>;
    };
  };
}

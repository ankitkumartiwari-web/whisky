# Whisky Music - Project Tree

> Full workspace structure (excluding `node_modules/`, `.git/`, and compiled artifacts).

```
AI Music Streaming App/                      # "Whisky Music" - Electron + React + Express + Python
├── .claude/
│   └── scheduled_tasks.lock
├── .github/
│   └── workflows/
│       └── supabase-keepalive.yml           # Cron ping to keep Supabase project alive
├── backend/
│   └── services/
│       └── youtubeService.ts                # YouTube audio resolution helper
├── electron/
│   ├── main.cjs                             # Electron main process (window, updater, server spawn)
│   ├── preload.cjs                          # IPC bridge exposed to renderer
│   └── splash.html                          # Boot splash screen
├── guidelines/
│   └── Guidelines.md
├── landing/
│   └── index.html                           # Static marketing/landing page
├── public/
│   ├── favicon.svg
│   └── sw.js                                # Service worker (PWA/offline)
├── recommender_service/
│   ├── README.md
│   ├── recommender_server.py                # Python recommendation service
│   └── training_data.jsonl                  # ML training dataset
├── scripts/
│   ├── build-icon.cjs                       # PNG -> ICO icon generation
│   ├── bundle-server.cjs                    # Bundles server into dist-server
│   └── release.cjs                          # Release/publish automation
├── server/
│   └── resend-api.mjs                       # Express API: email, metadata, search, AI, streaming
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── figma/
│   │   │   │   └── ImageWithFallback.tsx
│   │   │   ├── ui/                          # shadcn/Radix UI primitives (~50 files)
│   │   │   │   ├── accordion.tsx
│   │   │   │   ├── alert.tsx
│   │   │   │   ├── alert-dialog.tsx
│   │   │   │   ├── aspect-ratio.tsx
│   │   │   │   ├── avatar.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── breadcrumb.tsx
│   │   │   │   ├── button.tsx
│   │   │   │   ├── calendar.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── carousel.tsx
│   │   │   │   ├── chart.tsx
│   │   │   │   ├── checkbox.tsx
│   │   │   │   ├── collapsible.tsx
│   │   │   │   ├── command.tsx
│   │   │   │   ├── context-menu.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── drawer.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── form.tsx
│   │   │   │   ├── hover-card.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── input-otp.tsx
│   │   │   │   ├── label.tsx
│   │   │   │   ├── menubar.tsx
│   │   │   │   ├── navigation-menu.tsx
│   │   │   │   ├── pagination.tsx
│   │   │   │   ├── popover.tsx
│   │   │   │   ├── progress.tsx
│   │   │   │   ├── radio-group.tsx
│   │   │   │   ├── resizable.tsx
│   │   │   │   ├── scroll-area.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── separator.tsx
│   │   │   │   ├── sheet.tsx
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── skeleton.tsx
│   │   │   │   ├── slider.tsx
│   │   │   │   ├── sonner.tsx
│   │   │   │   ├── switch.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── textarea.tsx
│   │   │   │   ├── toggle.tsx
│   │   │   │   ├── toggle-group.tsx
│   │   │   │   ├── tooltip.tsx
│   │   │   │   ├── use-mobile.ts
│   │   │   │   └── utils.ts
│   │   │   ├── widgets/
│   │   │   │   ├── WidgetDock.tsx           # Floating widget dock
│   │   │   │   ├── WidgetManagerPage.tsx
│   │   │   │   ├── WidgetPicker.tsx
│   │   │   │   ├── widgetRegistry.tsx
│   │   │   │   └── widgetTypes.ts
│   │   │   ├── AIAssistant.tsx              # AI DJ / chat assistant
│   │   │   ├── CustomCursor.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── HiddenPlayer.tsx             # Hidden audio element controller
│   │   │   ├── LoginPage.tsx
│   │   │   ├── LyricsView.tsx
│   │   │   ├── MoodView.tsx                 # Mood-based discovery
│   │   │   ├── MultiUserSession.tsx         # Shared listening sessions
│   │   │   ├── MusicPlayer.tsx              # Main player UI
│   │   │   ├── musicStream.ts
│   │   │   ├── OnboardingModal.tsx
│   │   │   ├── ParticleBackground.tsx
│   │   │   ├── Player.tsx
│   │   │   ├── PlaylistCard.tsx
│   │   │   ├── ResetPasswordPage.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SongCard.tsx
│   │   │   ├── SongDetailsPage.tsx
│   │   │   ├── TopNavigation.tsx
│   │   │   ├── UserPlaylistsView.tsx
│   │   │   └── WaveformVisualizer.tsx
│   │   ├── context/
│   │   │   └── ThemeContext.tsx             # Light/dark theming
│   │   ├── data/
│   │   │   ├── catalogMetadata.ts
│   │   │   └── mockData.ts
│   │   ├── lib/
│   │   │   ├── aiCuratorApi.ts              # AI curator client
│   │   │   ├── backendAvailability.ts
│   │   │   ├── metadataApi.ts               # /api/metadata client
│   │   │   ├── offlineStore.ts
│   │   │   ├── playerDiagnostics.ts
│   │   │   ├── recommendationApi.ts
│   │   │   ├── recommendationEngine.ts
│   │   │   ├── resendApi.ts                 # Email API client
│   │   │   ├── songSearchApi.ts             # /api/search client
│   │   │   ├── supabaseClient.ts            # Supabase auth/db
│   │   │   ├── useOfflineStatus.ts
│   │   │   └── userPlaylistStore.ts
│   │   ├── App.tsx                          # Root app / view routing (~60 KB)
│   │   └── boneyardRegistry.ts
│   ├── imports/
│   │   └── pasted_text/
│   │       ├── ai-music-app-design.md
│   │       └── ai-music-app-design-1.md
│   ├── store/
│   │   └── playerStore.ts                   # Zustand player state
│   ├── styles/
│   │   ├── fonts.css
│   │   ├── index.css
│   │   ├── tailwind.css
│   │   └── theme.css
│   └── main.tsx                             # React entry point
├── .env                                     # Local secrets (NOT committed)
├── .env.example
├── .gitignore
├── api.log
├── ATTRIBUTIONS.md
├── build-output.log
├── embed-test.html
├── embed-test-2.html
├── index.html                               # Vite HTML entry
├── inspect-iframe.cjs
├── package.json                             # Scripts + Electron Builder config
├── package-lock.json
├── postcss.config.mjs
├── README.md
├── server-8787-cmd.err.log
├── server-8787-cmd.out.log
├── server-8788.err.log
├── server-8788.out.log
├── server-8788-cmd.err.log
├── server-8788-cmd.out.log
├── server-api.log
├── vite.config.ts
└── vite-dev.log
```

## Generated / Build Artifacts (excluded above)

| Path | Contents |
| --- | --- |
| `dist/` | Vite production build (`assets/`, `index.html`, `favicon.svg`, `sw.js`) |
| `dist-server/` | Bundled `resend-api.mjs` (3.3 MB) |
| `build/` | `icon.ico`, `icon.png`, `icon-512.png`, `yt-dlp.exe` |
| `release/` | Windows installers (`Whisky-Music-Setup.exe`, portable `.exe`, `win-unpacked/`, `latest.yml`) |
| `.netlify/` | `netlify.toml`, `state.json` |
| `node_modules/` | 80,798 files |

## Architecture Overview

React/Vite renderer (`src/`) -> Electron shell (`electron/`) -> local Express API (`server/resend-api.mjs`, port 8787) for email, metadata, search, AI, and audio streaming -> Supabase for auth/data + Resend for email + optional Python recommender (`recommender_service/`).

### Key API Endpoints (`server/resend-api.mjs`)

- `GET /api/health`
- `POST /api/send-welcome`
- `POST /api/send-password-reset`
- `POST /api/metadata/resolve`
- `POST /api/recommendations`
- `POST /api/recommendation-history`
- `GET /api/resolve-alt`
- `GET /api/audio-stream`
- `POST /api/search/ytmusic`
- `POST /api/search/songs`
- `POST /api/ai-curator`
- `POST /api/ai-curator/chat`

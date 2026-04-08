
  # Whisky Music

  This is the code bundle for Whisky Music.

  ## Running the code

  Run `npm i` to install the dependencies.

  Create a `.env` file from `.env.example` and set your Supabase credentials:

  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `APP_URL`
  - `API_RATE_LIMIT_WINDOW_MS`
  - `API_RATE_LIMIT_MAX`
  - `EMAIL_RATE_LIMIT_WINDOW_MS`
  - `EMAIL_RATE_LIMIT_MAX`
  - `RESET_RATE_LIMIT_WINDOW_MS`
  - `RESET_RATE_LIMIT_MAX`
  - `OPENROUTER_API_KEY`
  - `OPENROUTER_MODEL`
  - `OPENROUTER_BASE_URL`
  - `AI_RATE_LIMIT_WINDOW_MS`
  - `AI_RATE_LIMIT_MAX`
  - `GENIUS_ACCESS_TOKEN`
  - `GENIUS_BASE_URL`
  - `GENIUS_RATE_LIMIT_WINDOW_MS`
  - `GENIUS_RATE_LIMIT_MAX`
  - `METADATA_RATE_LIMIT_WINDOW_MS`
  - `METADATA_RATE_LIMIT_MAX`
  - `METADATA_PROVIDER` (`auto` | `genius` | `ytmusic`)
  - `METADATA_FALLBACK_ENABLED` (`true` | `false`)
  - `YTMUSIC_PROVIDER_URL` (optional HTTP endpoint)
  - `YTMUSIC_PROVIDER_TIMEOUT_MS`
  - `SEARCH_RATE_LIMIT_WINDOW_MS`
  - `SEARCH_RATE_LIMIT_MAX`
  - `SEARCH_PROVIDER` (`auto` | `ytmusic` | `itunes`)
  - `SEARCH_FALLBACK_ENABLED` (`true` | `false`)
  - `YTMUSIC_SEARCH_URL` (optional HTTP endpoint)
  - `YTMUSIC_SEARCH_TIMEOUT_MS`
  - `ITUNES_SEARCH_ENABLED` (`true` | `false`)

  Run `npm run dev:api` in one terminal to start the local Resend API.

  Run `npm run dev` in another terminal to start the Vite frontend.

  ## Metadata adapter contract

  The app now resolves song details through a unified endpoint:

  - `POST /api/metadata/resolve`
  - Body:
    - `songTitle` (required string)
    - `artistName` (optional string)
    - `spotifyScraper` (optional object, raw SpotifyScraper-style payload)

  Behavior:

  - If `spotifyScraper` is provided, the server adapts it to the app metadata shape.
  - Otherwise the server uses `METADATA_PROVIDER`:
    - `genius`: Genius first
    - `ytmusic`: YTMusic provider first
    - `auto`: Genius first, then YTMusic
  - If `METADATA_FALLBACK_ENABLED=true`, provider fallback is enabled for the second source.
  - YTMusic provider is optional and only used when `YTMUSIC_PROVIDER_URL` is configured.
  - Response remains compatible with existing UI metadata fields.

  ## Online song search contract

  The app search view can fetch online songs through:

  - `POST /api/search/songs`
  - Body:
    - `query` (required string)
    - `limit` (optional number, max 24)

  Search provider behavior:

  - `SEARCH_PROVIDER=ytmusic`: tries `YTMUSIC_SEARCH_URL` first.
  - `SEARCH_PROVIDER=itunes`: uses iTunes Search API first.
  - `SEARCH_PROVIDER=auto`: tries YTMusic first, then iTunes.
  - If `SEARCH_FALLBACK_ENABLED=true`, it attempts the secondary source.

  The Sign In form includes a `Forgot password?` action that sends a custom Resend password reset email.

  Recovery links open an in-app reset password screen styled with the same Whisky auth theme (light and dark mode).
  
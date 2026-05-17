
import dotenv from 'dotenv';
// In packaged builds main.cjs sets DOTENV_CONFIG_PATH to the .env shipped via extraResources;
// in dev it falls back to dotenv's default cwd lookup.
const envPath = process.env.DOTENV_CONFIG_PATH;
dotenv.config({ override: true, path: envPath || undefined });
import YTMusic from 'ytmusic-api';
const ytmusic = new YTMusic();
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
// --- YouTube Enrichment Layer for iTunes Results ---
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
if (!YOUTUBE_API_KEY) {
  console.warn('⚠️ Missing YOUTUBE_API_KEY');
}
const youtubeCache = new Map(); // key: `${title}|${artist}`

function extractVideoIdsFromYouTubeHtml(html) {
  if (!html || typeof html !== 'string') {
    return [];
  }

  const candidates = new Set();
  const patterns = [
    /"videoId":"([A-Za-z0-9_-]{11})"/g,
    /\/watch\?v=([A-Za-z0-9_-]{11})/g,
  ];

  patterns.forEach((pattern) => {
    for (const match of html.matchAll(pattern)) {
      const videoId = match[1];
      if (videoId) {
        candidates.add(videoId);
      }
    }
  });

  return Array.from(candidates);
}

async function searchYouTubeHtmlForSong(title, artist) {
  const queryText = `${title} ${artist} official song`;
  const query = encodeURIComponent(queryText);

  try {
    console.log('[YouTubeHtmlSearch] Searching:', `${title} - ${artist}`);
    const response = await fetch(
      `https://www.youtube.com/results?search_query=${query}&sp=EgIQAQ%253D%253D`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
    );

    const html = await response.text();
    const videoId = extractVideoIdsFromYouTubeHtml(html)[0] || null;
    console.log('[YouTubeHtmlSearch] Result:', { title, artist, videoId });
    return videoId;
  } catch (err) {
    console.error('[YouTubeHtmlSearch] Error:', err);
    return null;
  }
}

// Reuse a single ytmusic init promise — calling .initialize() repeatedly is wasteful.
let ytmusicReadyPromise = null;
async function ensureYtMusicReady() {
  if (!ytmusicReadyPromise) {
    ytmusicReadyPromise = ytmusic.initialize().catch((err) => {
      ytmusicReadyPromise = null;
      throw err;
    });
  }
  return ytmusicReadyPromise;
}

// Cache embeddability checks so we don't re-fetch the embed page for every search.
const embeddableCache = new Map();
async function isVideoEmbeddable(videoId) {
  if (!videoId) return false;
  const cached = embeddableCache.get(videoId);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(`https://www.youtube.com/embed/${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!res.ok) {
      embeddableCache.set(videoId, false);
      return false;
    }
    const body = await res.text();
    // YouTube's embed page sets playabilityStatus.status to "OK" for embeddable videos
    // and "UNPLAYABLE" / "ERROR" for non-embeddable. We also catch the common reason
    // strings that show up for embed-disabled videos.
    const okMatch = /"playabilityStatus"\s*:\s*\{\s*"status"\s*:\s*"OK"/.test(body);
    const blocked =
      /requested video does not allow it to be played in embedded players/i.test(body) ||
      /Video unavailable/.test(body);
    const ok = okMatch && !blocked;
    embeddableCache.set(videoId, ok);
    return ok;
  } catch (err) {
    // On a network error, optimistically allow it — better to try than to drop.
    return true;
  }
}

async function searchYTMusicForSong(title, artist) {
  try {
    await ensureYtMusicReady();
    const query = `${title} ${artist}`.trim();
    const results = await ytmusic.searchSongs(query);
    if (!Array.isArray(results)) return null;
    // Walk the top results and return the first one that's actually embeddable —
    // YT Music can surface videos whose owners have disabled embedding (especially
    // major-label tracks), and those return error 150 in the IFrame player.
    for (const candidate of results.slice(0, 5)) {
      if (!candidate?.videoId) continue;
      if (await isVideoEmbeddable(candidate.videoId)) {
        console.log('[YTMusic] Hit (embeddable)', `${title} - ${artist}`, '->', candidate.videoId);
        return candidate.videoId;
      }
      console.log('[YTMusic] Skip (not embeddable)', candidate.videoId);
    }
  } catch (err) {
    console.warn('[YTMusic] search failed:', err && err.message ? err.message : err);
  }
  return null;
}

async function searchYouTubeForSong(title, artist) {
  // Cache key prefixed v4 because v3 didn't validate embeddability — every cached
  // entry might be a non-embeddable videoId.
  const key = `v4|${title.toLowerCase().trim()}|${artist.toLowerCase().trim()}`;
  const now = Date.now();
  // 1 hour cache expiry
  const cached = youtubeCache.get(key);
  if (cached && (now - cached.ts < 60 * 60 * 1000)) {
    console.log('[YouTubeCache] HIT', key, cached.videoId);
    return cached.videoId;
  }
  let videoId = null;

  if (!YOUTUBE_API_KEY) {
    console.warn('No YOUTUBE_API_KEY set. Falling back to HTML search.');
  } else {
    const query = encodeURIComponent(`${title} ${artist} official song`);
    try {
      console.log('[YouTubeSearch] Searching:', `${title} - ${artist}`);
      // videoEmbeddable=true filters out videos whose owners disabled IFrame embedding —
      // without this, YouTube returns matches that 401/150 in our embedded player and
      // playback silently fails.
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&videoEmbeddable=true&maxResults=1&key=${YOUTUBE_API_KEY}`
      );
      const data = await res.json();
      videoId = data?.items?.[0]?.id?.videoId || null;
      console.log('[YouTubeSearch] Result:', { title, artist, videoId, data });

      const reason = data?.error?.errors?.[0]?.reason;
      if (!videoId && reason) {
        console.warn('[YouTubeSearch] Falling back after API error reason:', reason);
      }
    } catch (err) {
      console.error('[YouTubeSearch] Error:', err);
    }
  }

  if (!videoId) {
    // YT Music returns embeddable Topic-channel uploads — try this BEFORE the HTML
    // scraper, which often returns non-embeddable user-uploaded music videos.
    videoId = await searchYTMusicForSong(title, artist);
  }

  if (!videoId) {
    videoId = await searchYouTubeHtmlForSong(title, artist);
  }

  youtubeCache.set(key, { videoId, ts: now });
  return videoId;
}

async function attachYouTubeIdsToSongs(songs) {
  const results = await Promise.all(
    songs.map(async (song) => {
      if (song.videoId) return song;
      const videoId = await searchYouTubeForSong(song.title, song.artist);
      if (!videoId) {
        console.warn('[YouTubeEnrich] No videoId found for', song.title, '-', song.artist);
      }
      return { ...song, videoId };
    }),
  );
  return results;
}
// dotenv already configured at top of file with override: true
import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = Number(process.env.RESEND_API_PORT ?? 8787);
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.APP_URL ?? 'http://localhost:5173';
const apiRateLimitWindowMs = Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 60_000);
const apiRateLimitMax = Number(process.env.API_RATE_LIMIT_MAX ?? 60);
const emailRateLimitWindowMs = Number(process.env.EMAIL_RATE_LIMIT_WINDOW_MS ?? 60_000);
const emailRateLimitMax = Number(process.env.EMAIL_RATE_LIMIT_MAX ?? 8);
const resetRateLimitWindowMs = Number(process.env.RESET_RATE_LIMIT_WINDOW_MS ?? 15 * 60_000);
const resetRateLimitMax = Number(process.env.RESET_RATE_LIMIT_MAX ?? 5);
const aiRateLimitWindowMs = Number(process.env.AI_RATE_LIMIT_WINDOW_MS ?? 60_000);
const aiRateLimitMax = Number(process.env.AI_RATE_LIMIT_MAX ?? 20);
const metadataRateLimitWindowMs = Number(process.env.METADATA_RATE_LIMIT_WINDOW_MS ?? 60_000);
const metadataRateLimitMax = Number(process.env.METADATA_RATE_LIMIT_MAX ?? 30);
const searchRateLimitWindowMs = Number(process.env.SEARCH_RATE_LIMIT_WINDOW_MS ?? 60_000);
const searchRateLimitMax = Number(process.env.SEARCH_RATE_LIMIT_MAX ?? 30);
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const openRouterModel = process.env.OPENROUTER_MODEL ?? 'arcee-ai/trinity-large-preview';
const openRouterBaseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
const metadataProvider = (process.env.METADATA_PROVIDER ?? 'auto').toLowerCase();
const metadataFallbackEnabled = (process.env.METADATA_FALLBACK_ENABLED ?? 'true').toLowerCase() !== 'false';
const musicBrainzBaseUrl = process.env.MUSICBRAINZ_BASE_URL ?? 'https://musicbrainz.org/ws/2';
const musicBrainzUserAgent = process.env.MUSICBRAINZ_USER_AGENT ?? 'WhiskyMusicApp/1.0 (ankit.dev@gmail.com)';
const metadataCacheTtlMs = Number(process.env.METADATA_CACHE_TTL_MS ?? 90 * 24 * 60 * 60 * 1000);
const lyricsCacheTtlMs = Number(process.env.LYRICS_CACHE_TTL_MS ?? 30 * 24 * 60 * 60 * 1000);
const serpProvider = (process.env.SERP_PROVIDER ?? (process.env.SERP_API_KEY ? 'serper' : 'google')).toLowerCase();
const serpApiKey = process.env.SERP_API_KEY ?? '';
const serpSearchEngineId = process.env.SERP_SEARCH_ENGINE_ID ?? '';
const serpBaseUrl = process.env.SERP_BASE_URL
  ?? (serpProvider === 'serper' ? 'https://google.serper.dev/search' : 'https://www.googleapis.com/customsearch/v1');
const youtubeApiKey = process.env.YOUTUBE_API_KEY;
const youtubeRecommendationCache = new Map();
const recommenderServiceUrl = process.env.RECOMMENDER_SERVICE_URL ?? 'http://127.0.0.1:8790/recommendations';
const recommenderServiceTimeoutMs = Number(process.env.RECOMMENDER_SERVICE_TIMEOUT_MS ?? 2500);
const recommenderHistoryPath = process.env.RECOMMENDER_HISTORY_PATH ?? 'recommender_service/training_data.jsonl';
const ytmusicProviderUrl = process.env.YTMUSIC_PROVIDER_URL ?? '';
const ytmusicProviderTimeoutMs = Number(process.env.YTMUSIC_PROVIDER_TIMEOUT_MS ?? 3500);
const searchProvider = (process.env.SEARCH_PROVIDER ?? 'auto').toLowerCase();
const searchFallbackEnabled = (process.env.SEARCH_FALLBACK_ENABLED ?? 'true').toLowerCase() !== 'false';
const ytmusicSearchUrl = process.env.YTMUSIC_SEARCH_URL ?? '';
const ytmusicSearchTimeoutMs = Number(process.env.YTMUSIC_SEARCH_TIMEOUT_MS ?? 3500);
const itunesSearchEnabled = (process.env.ITUNES_SEARCH_ENABLED ?? 'true').toLowerCase() !== 'false';

if (!resendApiKey) {
  console.warn('[resend-api] Missing RESEND_API_KEY. Email sending will fail until it is set.');
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

app.use(express.json());
app.use(cors());

function getClientKey(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = typeof forwardedFor === 'string' ? forwardedFor.split(',')[0]?.trim() : '';
  return forwardedIp || req.ip || 'unknown';
}

function createRateLimit({ windowMs, maxRequests }) {
  const buckets = new Map();

  return (req, res, next) => {
    const key = `${getClientKey(req)}:${req.path}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.expiresAt <= now) {
      buckets.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (existing.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    existing.count += 1;
    buckets.set(key, existing);
    return next();
  };
}

const generalApiLimiter = createRateLimit({ windowMs: apiRateLimitWindowMs, maxRequests: apiRateLimitMax });
const emailEndpointLimiter = createRateLimit({
  windowMs: emailRateLimitWindowMs,
  maxRequests: emailRateLimitMax,
});
const passwordResetLimiter = createRateLimit({
  windowMs: resetRateLimitWindowMs,
  maxRequests: resetRateLimitMax,
});
const aiLimiter = createRateLimit({
  windowMs: aiRateLimitWindowMs,
  maxRequests: aiRateLimitMax,
});
const metadataLimiter = createRateLimit({
  windowMs: metadataRateLimitWindowMs,
  maxRequests: metadataRateLimitMax,
});
const searchLimiter = createRateLimit({
  windowMs: searchRateLimitWindowMs,
  maxRequests: searchRateLimitMax,
});

const metadataResolverCache = new Map();

function sanitizeMetadataInput(value) {
  return (value ?? '')
    .toString()
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>`$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function parseYearFromDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function getCachedMetadata(cacheKey) {
  const cached = metadataResolverCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    metadataResolverCache.delete(cacheKey);
    return null;
  }
  return cached.data;
}

function setCachedMetadata(cacheKey, data, ttlMs) {
  metadataResolverCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

function createMinTimeLimiter(minTimeMs) {
  let queue = Promise.resolve();
  let lastRunAt = 0;

  return async (task) => {
    const run = async () => {
      const elapsed = Date.now() - lastRunAt;
      const waitMs = Math.max(0, minTimeMs - elapsed);
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      lastRunAt = Date.now();
      return task();
    };

    const next = queue.then(run, run);
    queue = next.catch(() => {});
    return next;
  };
}

const runMusicBrainzRequest = createMinTimeLimiter(1000);

async function fetchMusicBrainzJson(url) {
  return runMusicBrainzRequest(async () => {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': musicBrainzUserAgent,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    return response.json().catch(() => null);
  });
}

function normalizeText(value) {
  return (value ?? '').toString().trim().toLowerCase();
}

function stripHtmlTags(value) {
  return (value ?? '')
    .toString()
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractYearFromText(value) {
  const match = (value ?? '').toString().match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function escapeRegExp(value) {
  return (value ?? '').toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractWikipediaTitleFromUrl(link) {
  try {
    const url = new URL(link);
    if (!/wikipedia\.org$/i.test(url.hostname)) return null;
    const title = url.pathname.split('/').pop();
    if (!title) return null;
    return decodeURIComponent(title.replace(/_/g, ' '));
  } catch {
    return null;
  }
}

function extractWikipediaInfoboxValue(html, label) {
  if (!html || !label) return '';
  const rowPattern = new RegExp(
    `<tr[^>]*>\\s*<th[^>]*>\\s*(?:<span[^>]*>)?${escapeRegExp(label)}(?:</span>)?\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`,
    'i',
  );
  const match = html.match(rowPattern);
  return match ? stripHtmlTags(match[1]) : '';
}

function firstDefinedString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function extractYouTubeVideoId(...values) {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    const watchMatch = trimmed.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (watchMatch) {
      return watchMatch[1];
    }

    const shortMatch = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (shortMatch) {
      return shortMatch[1];
    }

    const embedMatch = trimmed.match(/embed\/([A-Za-z0-9_-]{11})/);
    if (embedMatch) {
      return embedMatch[1];
    }
  }

  return '';
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

async function appendRecommendationHistory(record) {
  try {
    const absolutePath = path.isAbsolute(recommenderHistoryPath)
      ? recommenderHistoryPath
      : path.resolve(process.cwd(), recommenderHistoryPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await appendFile(absolutePath, `${JSON.stringify({
      ...record,
      timestamp: new Date().toISOString(),
    })}\n`, 'utf8');
  } catch (error) {
    console.warn('[Recommendations] Failed to append history record.', error?.message ?? error);
  }
}

function normalizeDurationSeconds(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return 210;
  }
  if (value > 10_000) {
    return Math.max(30, Math.round(value / 1000));
  }
  return Math.max(30, Math.round(value));
}

// FIX: normalizeSearchSong was split/broken in the original. Restored as a single clean function.
function normalizeSearchSong(item, source) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const youtubeSnippet = source === 'youtube'
    ? item?.snippet ?? item?.videoSnippet ?? null
    : null;
  const youtubeVideoId = source === 'youtube'
    ? extractYouTubeVideoId(item.videoId, item.youtubeVideoId, item.id?.videoId, item.url, item.webUrl)
    : '';

  const title = firstDefinedString(
    source === 'youtube' ? youtubeSnippet?.title : '',
    item.title,
    item.trackName,
    item.name,
  ) || 'Unknown Title';
  const artist = firstDefinedString(
    source === 'youtube' ? youtubeSnippet?.channelTitle : '',
    item.artist,
    item.artistName,
    item.artistDisplayName,
  ) || 'Unknown Artist';
  const album = firstDefinedString(
    source === 'youtube' ? youtubeSnippet?.channelTitle : '',
    item.album,
    item.albumName,
    item.collectionName,
    item.releaseName,
  ) || 'Single';

  // Upgrade iTunes artwork to high-res
  let coverUrl = firstDefinedString(
    source === 'youtube' ? youtubeSnippet?.thumbnails?.maxres?.url : '',
    source === 'youtube' ? youtubeSnippet?.thumbnails?.high?.url : '',
    source === 'youtube' ? youtubeSnippet?.thumbnails?.medium?.url : '',
    item.coverUrl,
    item.artworkUrl100,
    item.artworkUrl60,
    item.thumbnail,
    item.thumbnailUrl,
    item.image,
  ) || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=640';

  // iTunes: upgrade artworkUrl100/60 to 1200x1200
  if (coverUrl.includes('mzstatic.com/') && /\/(\d+)x\1bb\./.test(coverUrl)) {
    coverUrl = coverUrl.replace(/\/(\d+)x\1bb\./, '/1200x1200bb.');
  }

  // YTMusic: try to upgrade thumbnail quality
  if (coverUrl.includes('ytimg.com/')) {
    coverUrl = coverUrl.replace(/(hqdefault|maxresdefault|mqdefault|sddefault|minresdefault)/, 'maxresdefault');
  }

  // Spotify: use the largest image if an array is present
  if (Array.isArray(item.images) && item.images.length > 0 && item.images[0].url) {
    coverUrl = item.images[0].url;
  }

  if (source === 'youtube' && youtubeVideoId) {
    coverUrl = coverUrl || `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;
  }

  const duration = normalizeDurationSeconds(
    typeof item.duration === 'number'
      ? item.duration
      : typeof item.durationMs === 'number'
      ? item.durationMs
      : item.trackTimeMillis,
  );

  const videoId = extractYouTubeVideoId(
    item.videoId,
    item.youtubeId,
    item.youtubeVideoId,
    item.watchId,
    item.url,
    item.webUrl,
    source === 'youtube' ? youtubeVideoId : '',
    source === 'ytmusic' ? item.id : '',
  );
  const preferredId = source === 'youtube'
    ? firstDefinedString(youtubeVideoId, item.videoId, item.trackId)
    : firstDefinedString(item.id, item.videoId, item.trackId);
  const id = preferredId || `ext-${source}-${normalizeText(title)}-${normalizeText(artist)}`;

  const genre = firstDefinedString(
    item.genre,
    item.primaryGenreName,
    item.genreName,
  ) || '';

  const releaseDate = firstDefinedString(item.releaseDate, item.releaseDateOriginal) || '';
  const releaseYear = (() => {
    if (!releaseDate) return null;
    const yearMatch = releaseDate.match(/\d{4}/);
    return yearMatch ? Number(yearMatch[0]) : null;
  })();

  const country = firstDefinedString(item.country, item.collectionArtistCountry) || '';
  const artistId = item.artistId ? String(item.artistId) : '';

  return {
    id,
    title,
    artist,
    album,
    coverUrl,
    duration,
    isLiked: false,
    videoId: videoId || undefined,
    genre,
    releaseYear,
    country,
    artistId,
  };
}

function dedupeSearchSongs(songs) {
  const map = new Map();
  songs.forEach((song) => {
    if (!song) return;
    const key = `${normalizeText(song.title)}|${normalizeText(song.artist)}`;
    if (!map.has(key)) {
      map.set(key, song);
    }
  });
  return Array.from(map.values());
}

async function fetchYtMusicSearchResults(query, limit = 12) {
  if (!ytmusicSearchUrl) {
    return [];
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), ytmusicSearchTimeoutMs);

  try {
    const response = await fetch(ytmusicSearchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
      signal: controller.signal,
    });

    if (!response.ok) return [];

    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object') return [];

    const rawItems = toArray(
      payload.results?.length ? payload.results
      : payload.items?.length ? payload.items
      : payload.songs
    );
    return rawItems
      .slice(0, limit)
      .map((item) => normalizeSearchSong(item, 'ytmusic'))
      .filter(Boolean);
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutHandle);
  }
}

const itunesSearchCache = new Map();
const ITUNES_CACHE_TTL_MS = 60 * 60 * 1000;

async function fetchItunesSearchResults(query, limit = 12, country = '') {
  if (!itunesSearchEnabled) {
    return [];
  }

  const cacheKey = `${(country || '').toLowerCase()}|${query.trim().toLowerCase()}|${limit}`;
  const cachedEntry = itunesSearchCache.get(cacheKey);
  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.results;
  }

  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', query);
  url.searchParams.set('entity', 'song');
  url.searchParams.set('limit', String(Math.max(1, Math.min(limit, 25))));
  if (country && /^[a-z]{2}$/i.test(country)) {
    url.searchParams.set('country', country.toLowerCase());
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return [];

    const payload = await response.json().catch(() => null);
    const results = toArray(payload?.results);
    const normalized = results
      .slice(0, limit)
      .map((item) => normalizeSearchSong(item, 'itunes'))
      .filter(Boolean);
    itunesSearchCache.set(cacheKey, { results: normalized, expiresAt: Date.now() + ITUNES_CACHE_TTL_MS });
    return normalized;
  } catch {
    return [];
  }
}

async function resolveSongSearch(query, limit = 12) {
  const providerOrder = (() => {
    const selected = searchProvider === 'ytmusic' || searchProvider === 'itunes' || searchProvider === 'youtube'
      ? searchProvider
      : 'auto';

    if (selected === 'youtube') {
      return searchFallbackEnabled ? ['youtube', 'ytmusic', 'itunes'] : ['youtube'];
    }
    if (selected === 'ytmusic') {
      return searchFallbackEnabled ? ['ytmusic', 'youtube', 'itunes'] : ['ytmusic'];
    }
    if (selected === 'itunes') {
      return searchFallbackEnabled ? ['itunes', 'youtube', 'ytmusic'] : ['itunes'];
    }
    return searchFallbackEnabled ? ['youtube', 'ytmusic', 'itunes'] : ['youtube'];
  })();

  let resolvedSource = 'none';

  for (const provider of providerOrder) {
    let results = provider === 'youtube'
      ? (await fetchYouTubeSearchResults({ query, limit }))
          .map((item) => normalizeSearchSong(item, 'youtube'))
          .filter(Boolean)
      : provider === 'ytmusic'
        ? await fetchYtMusicSearchResults(query, limit)
        : await fetchItunesSearchResults(query, limit);

    // Enrich iTunes results with YouTube videoId
    if (provider === 'itunes' && results.length > 0) {
      results = await attachYouTubeIdsToSongs(results);
    }

    if (results.length > 0) {
      resolvedSource = provider;
      return {
        source: resolvedSource,
        results: dedupeSearchSongs(results).slice(0, limit),
      };
    }
  }

  return { source: resolvedSource, results: [] };
}

function normalizeSpotifyScraperMetadata(songTitle, artistName, spotifyScraper) {
  if (!spotifyScraper || typeof spotifyScraper !== 'object') {
    return null;
  }

  const track = spotifyScraper.track && typeof spotifyScraper.track === 'object'
    ? spotifyScraper.track
    : spotifyScraper;
  const artist = spotifyScraper.artist && typeof spotifyScraper.artist === 'object'
    ? spotifyScraper.artist
    : null;
  const annotations = toArray(spotifyScraper.annotations)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const fragment = firstDefinedString(item.fragment, item.context, item.label);
      const note = firstDefinedString(item.note, item.text, item.explanation, item.summary);
      if (!note) return null;
      return { fragment, note };
    })
    .filter(Boolean)
    .slice(0, 3);

  const trackArtists = toArray(track?.artists);
  const firstArtist = trackArtists[0] && typeof trackArtists[0] === 'object' ? trackArtists[0] : null;
  const trackAlbum = track?.album && typeof track.album === 'object' ? track.album : null;

  const title = firstDefinedString(track?.name, track?.title, songTitle);
  const resolvedArtistName = firstDefinedString(
    artist?.name,
    firstArtist?.name,
    track?.artist_name,
    artistName,
  );
  const albumName = firstDefinedString(trackAlbum?.name, track?.album_name, spotifyScraper?.albumName);
  const releaseDate = firstDefinedString(trackAlbum?.release_date, track?.release_date, spotifyScraper?.releaseDate);
  const spotifyUrl = firstDefinedString(
    track?.external_urls?.spotify,
    track?.url,
    track?.spotify_url,
    spotifyScraper?.url,
  );
  const trackId = firstDefinedString(track?.id, track?.track_id, spotifyScraper?.songId);
  const artistId = firstDefinedString(artist?.id, firstArtist?.id, spotifyScraper?.artistId);
  const artistImageUrl = firstDefinedString(
    artist?.image_url,
    artist?.image,
    firstArtist?.image_url,
    spotifyScraper?.artistImageUrl,
  ) || null;

  const songDescription = firstDefinedString(
    spotifyScraper?.songDescription,
    track?.description,
    track?.summary,
    track?.lyrics,
  ).slice(0, 700);
  const artistDescription = firstDefinedString(
    spotifyScraper?.artistDescription,
    artist?.description,
    artist?.bio,
  ).slice(0, 500);

  if (!title) return null;

  let albumImageUrl = null;
  if (trackAlbum && Array.isArray(trackAlbum.images) && trackAlbum.images.length > 0) {
    albumImageUrl = trackAlbum.images[0].url;
  } else if (track?.album_cover) {
    albumImageUrl = track.album_cover;
  }

  return {
    source: 'spotify-scraper',
    songId: trackId || `${normalizeText(title)}-${normalizeText(resolvedArtistName || 'unknown')}`,
    title,
    fullTitle: resolvedArtistName ? `${title} by ${resolvedArtistName}` : title,
    artistName: resolvedArtistName || artistName || 'Unknown Artist',
    artistId: artistId || null,
    artistImageUrl,
    albumImageUrl,
    artistDescription,
    songDescription,
    albumName: albumName || null,
    releaseDate: releaseDate || null,
    sourceUrl: spotifyUrl || null,
    annotationCount: annotations.length,
    topAnnotations: annotations,
  };
}

function normalizeYtMusicMetadata(songTitle, artistName, ytmusic) {
  if (!ytmusic || typeof ytmusic !== 'object') return null;

  const payload = ytmusic.metadata && typeof ytmusic.metadata === 'object' ? ytmusic.metadata : ytmusic;
  const topAnnotations = toArray(payload?.topAnnotations)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const fragment = firstDefinedString(item.fragment, item.context, item.label);
      const note = firstDefinedString(item.note, item.text, item.explanation);
      if (!note) return null;
      return { fragment, note };
    })
    .filter(Boolean)
    .slice(0, 3);

  const resolvedTitle = firstDefinedString(payload?.title, payload?.songTitle, songTitle);
  const resolvedArtist = firstDefinedString(payload?.artistName, payload?.artist, artistName);
  const resolvedSongId = firstDefinedString(payload?.songId, payload?.videoId, payload?.id);

  if (!resolvedTitle) return null;

  let albumImageUrl = firstDefinedString(payload?.albumArtUrl, payload?.albumArt, payload?.coverUrl, payload?.thumbnailUrl);
  if (albumImageUrl && albumImageUrl.includes('ytimg.com/')) {
    albumImageUrl = albumImageUrl.replace(/(hqdefault|maxresdefault|mqdefault|sddefault|minresdefault)/, 'maxresdefault');
  }

  return {
    source: 'ytmusic',
    songId: resolvedSongId || `${normalizeText(resolvedTitle)}-${normalizeText(resolvedArtist || 'unknown')}`,
    title: resolvedTitle,
    fullTitle: firstDefinedString(payload?.fullTitle) || (resolvedArtist ? `${resolvedTitle} by ${resolvedArtist}` : resolvedTitle),
    artistName: resolvedArtist || 'Unknown Artist',
    artistId: firstDefinedString(payload?.artistId, payload?.channelId) || null,
    artistImageUrl: firstDefinedString(payload?.artistImageUrl, payload?.artistThumbnail, payload?.thumbnailUrl) || null,
    albumImageUrl,
    artistDescription: firstDefinedString(payload?.artistDescription, payload?.artistBio).slice(0, 500),
    songDescription: firstDefinedString(payload?.songDescription, payload?.description, payload?.lyrics).slice(0, 700),
    albumName: firstDefinedString(payload?.albumName, payload?.album) || null,
    releaseDate: firstDefinedString(payload?.releaseDate, payload?.year) || null,
    sourceUrl: firstDefinedString(payload?.sourceUrl, payload?.ytmusicUrl, payload?.url, payload?.watchUrl) || null,
    annotationCount: Number(payload?.annotationCount ?? topAnnotations.length ?? 0),
    topAnnotations,
  };
}

async function fetchYtMusicMetadata(songTitle, artistName = '') {
  if (!ytmusicProviderUrl) return null;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), ytmusicProviderTimeoutMs);

  try {
    const response = await fetch(ytmusicProviderUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songTitle, artistName }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload = await response.json().catch(() => null);
    return normalizeYtMusicMetadata(songTitle, artistName, payload);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function fetchMusicBrainzMetadata(songTitle, artistName = '') {
  const cleanTitle = sanitizeMetadataInput(songTitle);
  const cleanArtist = sanitizeMetadataInput(artistName);
  const cacheKey = `musicbrainz:${normalizeText(cleanTitle)}|${normalizeText(cleanArtist)}`;
  const cached = getCachedMetadata(cacheKey);
  if (cached) return cached;

  const queryTerms = [];
  if (cleanTitle) queryTerms.push(`recording:"${cleanTitle}"`);
  if (cleanArtist) queryTerms.push(`artist:"${cleanArtist}"`);
  if (queryTerms.length === 0) return null;

  const url = new URL(`${musicBrainzBaseUrl.replace(/\/$/, '')}/recording/`);
  url.searchParams.set('query', queryTerms.join(' AND '));
  url.searchParams.set('fmt', 'json');
  url.searchParams.set('limit', '5');

  const payload = await fetchMusicBrainzJson(url.toString());
  const recordings = Array.isArray(payload?.recordings) ? payload.recordings : [];
  if (recordings.length === 0) return null;

  const preferred = recordings.find((recording) => {
    const recordingTitle = normalizeText(recording?.title);
    const recordingArtist = normalizeText(recording?.['artist-credit']?.[0]?.artist?.name ?? recording?.artist_credit?.[0]?.artist?.name);
    if (cleanArtist && recordingArtist !== normalizeText(cleanArtist)) {
      return false;
    }
    return !cleanTitle || recordingTitle.includes(normalizeText(cleanTitle)) || normalizeText(cleanTitle).includes(recordingTitle);
  }) ?? recordings[0];

  const artistCredit = Array.isArray(preferred?.['artist-credit']) ? preferred['artist-credit'] : [];
  const primaryArtist = artistCredit[0]?.artist ?? null;
  const release = Array.isArray(preferred?.releases) && preferred.releases.length > 0 ? preferred.releases[0] : null;
  const releaseDate = release?.date ?? release?.['first-release-date'] ?? null;
  const language = release?.['text-representation']?.language ?? release?.language ?? null;
  const genreTags = Array.isArray(preferred?.tags)
    ? preferred.tags
        .map((tag) => tag?.name)
        .filter((tag) => typeof tag === 'string' && tag.trim())
        .slice(0, 3)
    : [];

  const metadata = {
    source: 'musicbrainz',
    songId: String(preferred?.id ?? `${normalizeText(cleanTitle)}|${normalizeText(cleanArtist)}`),
    title: preferred?.title ?? cleanTitle,
    fullTitle: cleanArtist ? `${cleanTitle} by ${cleanArtist}` : (cleanTitle || ''),
    artistName: (primaryArtist?.name ?? cleanArtist) || 'Unknown Artist',
    artistId: primaryArtist?.id ? String(primaryArtist.id) : null,
    artistImageUrl: null,
    artistDescription: '',
    songDescription: preferred?.disambiguation
      ? `MusicBrainz match: ${preferred.disambiguation}`
      : 'MusicBrainz match found.',
    albumName: release?.title ?? null,
    releaseDate: releaseDate ? String(releaseDate) : null,
    sourceUrl: release?.id ? `https://musicbrainz.org/release/${release.id}` : null,
    annotationCount: 0,
    topAnnotations: [],
    genre: genreTags[0] ?? null,
    language: typeof language === 'string' && language.trim() ? language.trim() : null,
    originYear: parseYearFromDate(releaseDate),
  };

  setCachedMetadata(cacheKey, metadata, metadataCacheTtlMs);
  return metadata;
}

async function fetchLrclibLyrics(songTitle, artistName = '') {
  const cleanTitle = sanitizeMetadataInput(songTitle);
  const cleanArtist = sanitizeMetadataInput(artistName);
  const cacheKey = `lrclib:${normalizeText(cleanTitle)}|${normalizeText(cleanArtist)}`;
  const cached = getCachedMetadata(cacheKey);
  if (cached) return cached;

  const url = new URL('https://lrclib.net/api/get');
  if (cleanTitle) url.searchParams.set('track_name', cleanTitle);
  if (cleanArtist) url.searchParams.set('artist_name', cleanArtist);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;

    const payload = await response.json().catch(() => null);
    if (!payload) return null;

    const plainLyrics = typeof payload?.plainLyrics === 'string' ? payload.plainLyrics.trim() : '';
    const syncedLyrics = typeof payload?.syncedLyrics === 'string' ? payload.syncedLyrics.trim() : '';
    const lyrics = plainLyrics || syncedLyrics;

    if (!lyrics) return null;

    const metadata = {
      source: 'lrclib',
      lyrics,
      syncedLyrics: syncedLyrics || null,
      albumName: typeof payload?.albumName === 'string' && payload.albumName.trim() ? payload.albumName.trim() : null,
      sourceUrl: typeof payload?.url === 'string' && payload.url.trim() ? payload.url.trim() : null,
    };

    setCachedMetadata(cacheKey, metadata, lyricsCacheTtlMs);
    return metadata;
  } catch {
    return null;
  }
}

async function fetchSerpFallbackMetadata(songTitle, artistName = '') {
  const cleanTitle = sanitizeMetadataInput(songTitle);
  const cleanArtist = sanitizeMetadataInput(artistName);
  const cacheKey = `serp:${normalizeText(cleanTitle)}|${normalizeText(cleanArtist)}`;
  const cached = getCachedMetadata(cacheKey);
  if (cached) return cached;

  const query = [cleanTitle, cleanArtist].filter(Boolean).join(' ').trim();
  if (!query) return null;

  const searchResults = await fetchSerpSearchResults(`${query} wikipedia genre language year lyrics`);
  if (searchResults.length === 0) return null;

  const sourcePayload = {
    results: searchResults.map((item) => ({
      title: stripHtmlTags(item?.title ?? ''),
      link: typeof item?.link === 'string' ? item.link : '',
      snippet: stripHtmlTags(item?.snippet ?? ''),
    })),
  };

  const modelResponse = await callOpenRouterJson({
    systemPrompt: [
      'You are a music metadata extractor.',
      'You receive search results and must return STRICT JSON only.',
      'Use only the provided sources. Do not invent facts.',
      'For lyrics, never output full copyrighted lyrics.',
      'Return at most a short excerpt or summary if supported by the snippets.',
      'Schema:',
      '{',
      '  "genre": "string|null",',
      '  "language": "string|null",',
      '  "originYear": "number|null",',
      '  "songDescription": "string|null",',
      '  "sourceUrl": "string|null"',
      '}',
    ].join('\n'),
    userPayload: { songTitle: cleanTitle, artistName: cleanArtist, sources: sourcePayload },
  });

  const bestSourceUrl = typeof modelResponse?.sourceUrl === 'string' && modelResponse.sourceUrl.trim()
    ? modelResponse.sourceUrl.trim()
    : sourcePayload.results[0]?.link ?? null;
  const fallbackSnippet = sourcePayload.results[0]?.snippet || '';

  const metadata = {
    source: 'serp',
    songId: `${normalizeText(cleanTitle)}|${normalizeText(cleanArtist)}` || cleanTitle,
    title: cleanTitle,
    fullTitle: cleanArtist ? `${cleanTitle} by ${cleanArtist}` : cleanTitle,
    artistName: cleanArtist || 'Unknown Artist',
    artistId: null,
    artistImageUrl: null,
    artistDescription: '',
    songDescription: typeof modelResponse?.songDescription === 'string' && modelResponse.songDescription.trim()
      ? modelResponse.songDescription.trim()
      : fallbackSnippet,
    albumName: null,
    releaseDate: typeof modelResponse?.originYear === 'number' ? String(modelResponse.originYear) : null,
    sourceUrl: bestSourceUrl,
    annotationCount: 0,
    topAnnotations: [],
    genre: typeof modelResponse?.genre === 'string' && modelResponse.genre.trim() ? modelResponse.genre.trim() : null,
    language: typeof modelResponse?.language === 'string' && modelResponse.language.trim() ? modelResponse.language.trim() : null,
    originYear: typeof modelResponse?.originYear === 'number' ? modelResponse.originYear : null,
  };

  setCachedMetadata(cacheKey, metadata, metadataCacheTtlMs);
  return metadata;
}

async function fetchSerpSearchResults(query) {
  const cleanQuery = sanitizeMetadataInput(query);
  if (!cleanQuery) return [];

  try {
    if (serpProvider === 'serper') {
      if (!serpApiKey) return [];

      const response = await fetch(serpBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': serpApiKey,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          q: cleanQuery,
          gl: 'us',
          hl: 'en',
          num: 5,
        }),
      });

      if (!response.ok) return [];
      const payload = await response.json().catch(() => null);
      const organic = Array.isArray(payload?.organic) ? payload.organic : [];
      return organic;
    }

    if (!serpApiKey || !serpSearchEngineId) return [];

    const url = new URL(serpBaseUrl);
    url.searchParams.set('key', serpApiKey);
    url.searchParams.set('cx', serpSearchEngineId);
    url.searchParams.set('q', cleanQuery);
    url.searchParams.set('num', '5');

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return [];

    const payload = await response.json().catch(() => null);
    return Array.isArray(payload?.items) ? payload.items : [];
  } catch {
    return [];
  }
}

async function fetchGoogleSearchResults(query) {
  return fetchSerpSearchResults(query);
}

async function callOpenRouterJson({ systemPrompt, userPayload, temperature = 0.2 }) {
  if (!openRouterApiKey) return null;

  const response = await fetch(`${openRouterBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: openRouterModel,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  const content = payload?.choices?.[0]?.message?.content ?? '';
  return extractJsonObject(content);
}

function uniqueStrings(values) {
  return Array.from(new Set((values ?? []).filter((value) => typeof value === 'string' && value.trim())));
}

function stripYouTubeTitleDecorations(value) {
  return stripHtmlTags(value)
    .replace(/\s*[\[(][^)\]]*(official|lyrics|video|audio|visualizer|mv|hd)[^)\]]*[\])]/gi, ' ')
    .replace(/\s*[-|:]\s*(official|music video|lyrics|audio|video|mv|hd).*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseYouTubeVideoTitle(rawTitle, channelTitle) {
  const cleanTitle = stripYouTubeTitleDecorations(rawTitle) || stripHtmlTags(rawTitle) || 'YouTube Track';
  const cleanChannel = stripHtmlTags(channelTitle) || 'YouTube';
  const lowerChannel = normalizeText(cleanChannel);

  const separators = [' - ', ' | ', ' : '];
  for (const separator of separators) {
    if (!cleanTitle.includes(separator)) continue;
    const parts = cleanTitle.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) continue;

    const first = parts[0];
    const second = parts[1];
    const firstMatchesChannel = lowerChannel && normalizeText(first).includes(lowerChannel);
    const secondMatchesChannel = lowerChannel && normalizeText(second).includes(lowerChannel);

    if (firstMatchesChannel && !secondMatchesChannel) {
      return { title: second, artist: cleanChannel };
    }

    if (secondMatchesChannel && !firstMatchesChannel) {
      return { title: first, artist: cleanChannel };
    }

    return { title: first, artist: second || cleanChannel };
  }

  return { title: cleanTitle, artist: cleanChannel };
}

async function fetchYouTubeSearchResults({ query = '', relatedToVideoId = '', limit = 5 }) {
  if (!youtubeApiKey) return [];

  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  const normalizedRelated = typeof relatedToVideoId === 'string' ? relatedToVideoId.trim() : '';
  const safeLimit = Math.max(1, Math.min(Number(limit) || 5, 10));
  const cacheKey = `${normalizedRelated || normalizedQuery}|${safeLimit}`;
  const cached = youtubeRecommendationCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.items;
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('order', 'relevance');
  url.searchParams.set('maxResults', String(safeLimit));
  url.searchParams.set('videoEmbeddable', 'true');
  if (normalizedQuery) {
    url.searchParams.set('q', normalizedQuery);
  }
  if (normalizedRelated) {
    url.searchParams.set('relatedToVideoId', normalizedRelated);
  }
  url.searchParams.set('key', youtubeApiKey);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json().catch(() => null);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    youtubeRecommendationCache.set(cacheKey, {
      items,
      expiresAt: now + 15 * 60_000,
    });
    return items;
  } catch (error) {
    console.error('[YouTubeRecommendations] Search failed:', error);
    return [];
  }
}

function buildYouTubeRecommendationQueries({ seedSongs, topGenre, topLanguage, topMood, topActivity, currentSong }) {
  const queries = [];

  if (currentSong?.videoId && currentSong.title) {
    queries.push({
      kind: 'related',
      relatedToVideoId: currentSong.videoId,
      label: `related:${currentSong.videoId}`,
    });
  }

  seedSongs.slice(0, 3).forEach((seed) => {
    const seedQueryParts = uniqueStrings([
      seed.artist,
      seed.genre,
      seed.language,
      seed.moods?.[0],
    ]);
    if (seedQueryParts.length > 0) {
      queries.push({ kind: 'query', query: `${seedQueryParts.join(' ')} official audio`.trim() });
    }
    if (seed.artist) {
      queries.push({ kind: 'query', query: `${seed.artist} official audio`.trim() });
    }
    if (seed.genre && seed.moods?.[0]) {
      queries.push({ kind: 'query', query: `${seed.genre} ${seed.moods[0]} music`.trim() });
    }
  });

  if (topGenre) {
    queries.push({
      kind: 'query',
      query: [topGenre, topLanguage, topMood].filter(Boolean).join(' '),
    });
    queries.push({
      kind: 'query',
      query: [topGenre, topActivity, 'music'].filter(Boolean).join(' '),
    });
  }

  if (topMood) {
    queries.push({
      kind: 'query',
      query: [topMood, topGenre, 'songs'].filter(Boolean).join(' '),
    });
  }

  if (queries.length === 0) {
    queries.push({ kind: 'query', query: 'trending music official audio' });
  }

  return queries.filter((item) => item.kind === 'related' || (item.query && item.query.trim()));
}

function makeSongFromYouTubeItem(item) {
  const videoId = typeof item?.id?.videoId === 'string' ? item.id.videoId.trim() : '';
  if (!videoId) return null;

  const rawTitle = typeof item?.snippet?.title === 'string' ? item.snippet.title : '';
  const channelTitle = typeof item?.snippet?.channelTitle === 'string' ? item.snippet.channelTitle : 'YouTube';
  const parsed = parseYouTubeVideoTitle(rawTitle, channelTitle);
  const title = parsed.title || rawTitle || 'YouTube Track';
  const artist = parsed.artist || channelTitle || 'YouTube';

  return {
    id: `yt-${videoId}`,
    title,
    artist,
    album: channelTitle || 'YouTube',
    coverUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    duration: 0,
    isLiked: false,
    videoId,
  };
}

function scoreYouTubeCandidate(candidate, profile) {
  let score = 0;
  const candidateTitle = normalizeText(candidate.title);
  const candidateArtist = normalizeText(candidate.artist);
  const candidateAlbum = normalizeText(candidate.album);

  if (candidateArtist) score += 5;

  profile.seedSongs.forEach((seed) => {
    const seedArtist = normalizeText(seed.artist);
    const seedTitle = normalizeText(seed.title);
    const seedGenre = normalizeText(seed.genre);
    const seedLanguage = normalizeText(seed.language);
    const seedMood = Array.isArray(seed.moods) ? seed.moods.map(normalizeText).filter(Boolean)[0] : '';
    const seedActivity = Array.isArray(seed.activities) ? seed.activities.map(normalizeText).filter(Boolean)[0] : '';

    if (seedArtist && (candidateArtist.includes(seedArtist) || candidateTitle.includes(seedArtist) || candidateAlbum.includes(seedArtist))) {
      score += 60;
    }
    if (seedTitle && (candidateTitle.includes(seedTitle) || candidateArtist.includes(seedTitle))) {
      score += 20;
    }
    if (seedGenre && (candidateTitle.includes(seedGenre) || candidateAlbum.includes(seedGenre))) {
      score += 16;
    }
    if (seedLanguage && (candidateTitle.includes(seedLanguage) || candidateAlbum.includes(seedLanguage))) {
      score += 10;
    }
    if (seedMood && candidateTitle.includes(seedMood)) {
      score += 6;
    }
    if (seedActivity && candidateTitle.includes(seedActivity)) {
      score += 5;
    }
  });

  if (candidateTitle.includes('official')) score += 5;
  if (candidateTitle.includes('audio')) score += 3;

  return score;
}

async function rerankYouTubeRecommendationsWithTrinity(candidates, profileSummary) {
  if (!openRouterApiKey || candidates.length === 0) return candidates;

  const response = await callOpenRouterJson({
    systemPrompt: [
      'You are Trinity, a music recommendation assistant.',
      'Return STRICT JSON only.',
      'Rank the provided YouTube candidate songs by how well they match the user profile.',
      'Only use the provided candidate ids.',
      'Return schema: { "songIds": ["id1","id2",...]}',
    ].join('\n'),
    userPayload: {
      profileSummary,
      candidates: candidates.map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        artist: candidate.artist,
        album: candidate.album,
        videoId: candidate.videoId,
      })),
    },
    temperature: 0.1,
  });

  const rankedIds = Array.isArray(response?.songIds)
    ? response.songIds.filter((id) => candidates.some((candidate) => candidate.id === id))
    : [];

  if (rankedIds.length === 0) return candidates;

  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const ranked = [];
  rankedIds.forEach((id) => {
    const item = candidateMap.get(id);
    if (item) {
      ranked.push(item);
      candidateMap.delete(id);
    }
  });

  return [...ranked, ...Array.from(candidateMap.values())];
}

async function fetchPythonRecommendations({ songs, likedSongIds, recentlyPlayedIds, currentSongId, limit }) {
  if (!recommenderServiceUrl) return null;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), recommenderServiceTimeoutMs);

  try {
    const response = await fetch(recommenderServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        catalog: {
          songs,
        },
        likedSongIds,
        recentlyPlayedIds,
        currentSongId,
        limit,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload = await response.json().catch(() => null);
    const serviceSongs = Array.isArray(payload?.songs) ? payload.songs : [];
    const songIds = Array.isArray(payload?.songIds) ? payload.songIds : [];

    if (serviceSongs.length === 0 && songIds.length === 0) {
      return null;
    }

    return {
      songs: serviceSongs,
      songIds,
      source: typeof payload?.source === 'string' ? payload.source : 'python-ml-service',
    };
  } catch (error) {
    console.warn('[Recommendations] Python service unavailable, falling back locally.', error?.message ?? error);
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function recommendSongsFromYouTube({
  songs,
  likedSongIds = [],
  recentlyPlayedIds = [],
  currentSongId = null,
  limit = 8,
}) {
  const serviceResult = await fetchPythonRecommendations({
    songs,
    likedSongIds,
    recentlyPlayedIds,
    currentSongId,
    limit,
  });

  if (serviceResult) {
    return serviceResult;
  }

  if (!youtubeApiKey) {
    const fallback = await recommendSongsFromCatalog({
      songs,
      likedSongIds,
      recentlyPlayedIds,
      currentSongId,
      limit,
    });

    return {
      ...fallback,
      songs: fallback.songIds
        .map((songId) => songs.find((song) => song.id === songId))
        .filter(Boolean),
      source: fallback.source,
    };
  }

  const profile = buildRecommendationProfile(songs, likedSongIds, recentlyPlayedIds, currentSongId);
  const currentSong = songs.find((song) => song.id === currentSongId) ?? null;
  const blockedIds = new Set([...(likedSongIds || []), ...(recentlyPlayedIds || []), currentSongId].filter(Boolean));
  const currentVideoId = currentSong?.videoId && isValidYouTubeVideoId(currentSong.videoId) ? currentSong.videoId : null;

  const genreCounts = new Map();
  const languageCounts = new Map();
  const moodCounts = new Map();
  const activityCounts = new Map();
  const artistCounts = new Map();

  profile.seedSongs.forEach((seed) => {
    if (seed.genre) genreCounts.set(seed.genre, (genreCounts.get(seed.genre) ?? 0) + 1);
    if (seed.language) languageCounts.set(seed.language, (languageCounts.get(seed.language) ?? 0) + 1);
    if (Array.isArray(seed.moods)) seed.moods.forEach((mood) => moodCounts.set(mood, (moodCounts.get(mood) ?? 0) + 1));
    if (Array.isArray(seed.activities)) seed.activities.forEach((activity) => activityCounts.set(activity, (activityCounts.get(activity) ?? 0) + 1));
    artistCounts.set(seed.artist, (artistCounts.get(seed.artist) ?? 0) + 1);
  });

  const topGenre = Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topLanguage = Array.from(languageCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topMood = Array.from(moodCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topActivity = Array.from(activityCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const queries = buildYouTubeRecommendationQueries({
    seedSongs: profile.seedSongs,
    topGenre,
    topLanguage,
    topMood,
    topActivity,
    currentSong,
  });

  const candidateMap = new Map();

  if (currentVideoId) {
    const relatedItems = await fetchYouTubeSearchResults({ relatedToVideoId: currentVideoId, limit: Math.min(5, limit) });
    relatedItems.forEach((item) => {
      const song = makeSongFromYouTubeItem(item);
      if (!song || blockedIds.has(song.id)) return;
      candidateMap.set(song.videoId, {
        song,
        source: 'related',
      });
    });
  }

  for (const queryDescriptor of queries) {
    if (queryDescriptor.kind !== 'query') continue;
    const items = await fetchYouTubeSearchResults({ query: queryDescriptor.query, limit: Math.min(5, limit) });
    items.forEach((item) => {
      const song = makeSongFromYouTubeItem(item);
      if (!song || blockedIds.has(song.id) || candidateMap.has(song.videoId)) return;
      candidateMap.set(song.videoId, {
        song,
        source: 'query',
      });
    });
  }

  let candidates = Array.from(candidateMap.values()).map((entry) => ({
    ...entry.song,
    _source: entry.source,
    _score: scoreYouTubeCandidate(entry.song, profile) + (entry.source === 'related' ? 10 : 0),
  }));

  candidates.sort((a, b) => b._score - a._score);

  const profileSummary = {
    likedSongIds,
    recentlyPlayedIds,
    currentSongId,
    seedSongs: profile.seedSongs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      genre: song.genre,
      language: song.language,
      energy: song.energy,
    })),
    topGenre,
    topLanguage,
    topMood,
    topActivity,
  };

  candidates = await rerankYouTubeRecommendationsWithTrinity(candidates, profileSummary).catch(() => candidates);

  if (candidates.length === 0) {
    const fallback = await recommendSongsFromCatalog({
      songs,
      likedSongIds,
      recentlyPlayedIds,
      currentSongId,
      limit,
    });

    return {
      ...fallback,
      songs: fallback.songIds
        .map((songId) => songs.find((song) => song.id === songId))
        .filter(Boolean),
      source: fallback.source,
    };
  }

  const selected = candidates.slice(0, limit).map((candidate) => {
    const { _score, _source, ...song } = candidate;
    return song;
  });

  return {
    songIds: selected.map((song) => song.id),
    songs: selected,
    source: openRouterApiKey ? 'youtube-trinity' : 'youtube',
  };
}

async function resolveMetadata({ songTitle, artistName = '', spotifyScraper = null }) {
  const cleanTitle = sanitizeMetadataInput(songTitle);
  const cleanArtist = sanitizeMetadataInput(artistName);
  const adaptedSpotify = normalizeSpotifyScraperMetadata(cleanTitle, cleanArtist, spotifyScraper);
  if (adaptedSpotify) return adaptedSpotify;

  const cacheKey = `resolve:${normalizeText(cleanTitle)}|${normalizeText(cleanArtist)}`;
  const cached = getCachedMetadata(cacheKey);
  if (cached) {
    return cached;
  }

  const baseMetadata = {
    source: 'musicbrainz',
    songId: `${normalizeText(cleanTitle)}|${normalizeText(cleanArtist)}` || cleanTitle,
    title: cleanTitle || 'Unknown Title',
    fullTitle: cleanArtist ? `${cleanTitle} by ${cleanArtist}` : cleanTitle || 'Unknown Title',
    artistName: cleanArtist || 'Unknown Artist',
    artistId: null,
    artistImageUrl: null,
    artistDescription: '',
    songDescription: '',
    albumName: null,
    releaseDate: null,
    sourceUrl: null,
    annotationCount: 0,
    topAnnotations: [],
    genre: null,
    language: null,
    originYear: null,
  };

  const musicBrainzMetadata = await fetchMusicBrainzMetadata(cleanTitle, cleanArtist).catch(() => null);
  const lrclibMetadata = await fetchLrclibLyrics(cleanTitle, cleanArtist).catch(() => null);

  const metadata = {
    ...baseMetadata,
    ...(musicBrainzMetadata ?? {}),
  };

  if (lrclibMetadata?.lyrics) {
    metadata.songDescription = lrclibMetadata.lyrics;
  } else if (musicBrainzMetadata?.songDescription) {
    metadata.songDescription = musicBrainzMetadata.songDescription;
  }
  if (lrclibMetadata?.syncedLyrics) {
    metadata.syncedLyrics = lrclibMetadata.syncedLyrics;
  }

  if (!metadata.albumName && lrclibMetadata?.albumName) {
    metadata.albumName = lrclibMetadata.albumName;
  }

  if (!metadata.sourceUrl && lrclibMetadata?.sourceUrl) {
    metadata.sourceUrl = lrclibMetadata.sourceUrl;
  }

  if (metadataFallbackEnabled && (!metadata.genre || !metadata.language || !metadata.originYear || !metadata.songDescription)) {
    const serpMetadata = await fetchSerpFallbackMetadata(cleanTitle, cleanArtist).catch(() => null);
    if (serpMetadata) {
      metadata.genre ||= serpMetadata.genre ?? null;
      metadata.language ||= serpMetadata.language ?? null;
      metadata.originYear ||= serpMetadata.originYear ?? null;
      metadata.releaseDate ||= serpMetadata.releaseDate ?? null;
      metadata.songDescription ||= serpMetadata.songDescription ?? '';
      metadata.sourceUrl ||= serpMetadata.sourceUrl ?? null;
      metadata.source = serpMetadata.source === 'serp'
        ? 'MusicBrainz + LRCLIB + SERP'
        : metadata.source;
    }
  }

  if (openRouterApiKey) {
    metadata.source = metadata.source === 'MusicBrainz + LRCLIB + SERP'
      ? 'MusicBrainz + LRCLIB + Trinity + SERP'
      : 'MusicBrainz + LRCLIB + Trinity';
  }

  if (!metadata.songDescription) {
    metadata.songDescription = lrclibMetadata?.lyrics ?? '';
  }

  if (!metadata.songDescription && metadataFallbackEnabled) {
    const serpMetadata = await fetchSerpFallbackMetadata(cleanTitle, cleanArtist).catch(() => null);
    if (serpMetadata?.songDescription) {
      metadata.songDescription = serpMetadata.songDescription;
    }
  }

  if (!metadata.songDescription) {
    metadata.songDescription = `Metadata resolved for ${cleanTitle || 'unknown song'}.`;
  }

  setCachedMetadata(cacheKey, metadata, metadataCacheTtlMs);
  return metadata;
}

function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  try {
    return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function buildAlbumCatalog(songs) {
  const albumMap = new Map();
  songs.forEach((song) => {
    const title = firstDefinedString(song.originTitle, song.album);
    if (!title) return;
    const existing = albumMap.get(title) ?? {
      id: title,
      title,
      songIds: [],
      year: song.originYear ?? 2024,
      language: song.language ?? 'Unknown',
      genre: song.genre ?? 'Unknown',
    };
    existing.songIds.push(song.id);
    if (!existing.year && song.originYear) existing.year = song.originYear;
    albumMap.set(title, existing);
  });
  return Array.from(albumMap.values());
}

function heuristicCurator(prompt, songs, playlists, searchResults, albums = []) {
  const input = (prompt ?? '').toLowerCase();
  const rankedPool = searchResults.length > 0 ? searchResults : songs;

  const scored = rankedPool
    .map((song) => {
      let score = 0;
      if (input.includes('chill') || input.includes('relax')) {
        if (song.energy === 'low') score += 3;
        if (song.moods?.includes('calm')) score += 2;
      }
      if (input.includes('workout') || input.includes('gym') || input.includes('run')) {
        if (song.energy === 'high') score += 3;
        if (song.activities?.includes('workout')) score += 2;
      }
      if (input.includes('study') || input.includes('focus')) {
        if (song.activities?.includes('focus')) score += 3;
        if (song.isInstrumental) score += 2;
      }
      if (input.includes('night') || input.includes('late')) {
        if (song.timeOfDay?.includes('late-night') || song.timeOfDay?.includes('night')) score += 2;
      }
      if (input.includes('soft')) {
        if (song.energy === 'low') score += 2;
      }
      if (input.includes('instrumental') || input.includes('no vocals')) {
        if (song.isInstrumental) score += 3;
      }
      if (score === 0) score = 1;
      return { song, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const topSongs = scored.map((entry) => entry.song);
  const albumPool = albums.length > 0 ? albums : buildAlbumCatalog(songs);
  const topAlbumIds = Array.from(new Set(
    topSongs
      .map((song) => firstDefinedString(song.originTitle, song.album))
      .filter(Boolean),
  )).slice(0, 3);

  return {
    intent: input.includes('workout') ? 'workout' : input.includes('study') ? 'focus' : 'general',
    responseText: 'Here is a curated set from your existing catalog based on your request.',
    suggestions: [
      ...topSongs.map((song) => ({
        type: 'song',
        id: song.id,
        reason: `Matches your request with ${song.energy} energy and ${song.genre} style.`,
      })),
      ...topAlbumIds.map((albumId) => {
        const album = albumPool.find((item) => item.id === albumId);
        return {
          type: 'album',
          id: albumId,
          reason: album
            ? `This album fits your request with ${album.genre} energy and ${album.language} vocals.`
            : 'This album matches the vibe of your request.',
        };
      }),
    ],
    playlistBuilder: {
      name: 'AI Curated Mix',
      description: 'Generated from your prompt using your catalog only.',
      songIds: topSongs.map((song) => song.id),
    },
    rerankedSongIds: topSongs.map((song) => song.id),
    details: null,
  };
}

// FIX: sanitizeAiResult was split mid-function with misplaced code. Fully restored.
function sanitizeAiResult(candidate, songs, playlists, fallback) {
  const songIds = new Set(songs.map((song) => song.id));
  const playlistIds = new Set(playlists.map((playlist) => playlist.id));
  const albumIds = new Set(songs.map((song) => firstDefinedString(song.originTitle, song.album)).filter(Boolean));
  const artistNames = new Set(songs.map((song) => song.artist));
  const originTitles = new Set(songs.map((song) => song.originTitle || song.album));

  const suggestions = Array.isArray(candidate?.suggestions)
    ? candidate.suggestions
        .filter((item) => {
          if (!item || typeof item !== 'object') return false;
          if (item.type === 'song') return songIds.has(item.id);
          if (item.type === 'playlist') return playlistIds.has(item.id);
          if (item.type === 'album') return albumIds.has(item.id);
          return false;
        })
        .map((item) => ({
          type: item.type,
          id: item.id,
          reason: typeof item.reason === 'string' ? item.reason : 'Recommended by AI for your request.',
        }))
    : fallback.suggestions;

  const playlistSongIds = Array.isArray(candidate?.playlistBuilder?.songIds)
    ? candidate.playlistBuilder.songIds.filter((id) => songIds.has(id))
    : fallback.playlistBuilder.songIds;

  const rerankedSongIds = Array.isArray(candidate?.rerankedSongIds)
    ? candidate.rerankedSongIds.filter((id) => songIds.has(id))
    : fallback.rerankedSongIds;

  const detailSongId = typeof candidate?.details?.songId === 'string' && songIds.has(candidate.details.songId)
    ? candidate.details.songId
    : null;
  const detailArtistName = typeof candidate?.details?.artistName === 'string' && artistNames.has(candidate.details.artistName)
    ? candidate.details.artistName
    : null;
  const detailOriginTitle = typeof candidate?.details?.originTitle === 'string' && originTitles.has(candidate.details.originTitle)
    ? candidate.details.originTitle
    : null;

  return {
    intent: typeof candidate?.intent === 'string' ? candidate.intent : fallback.intent,
    responseText: typeof candidate?.responseText === 'string' ? candidate.responseText : fallback.responseText,
    suggestions: suggestions.length > 0 ? suggestions : fallback.suggestions,
    playlistBuilder: {
      name: typeof candidate?.playlistBuilder?.name === 'string' ? candidate.playlistBuilder.name : fallback.playlistBuilder.name,
      description: typeof candidate?.playlistBuilder?.description === 'string'
        ? candidate.playlistBuilder.description
        : fallback.playlistBuilder.description,
      songIds: playlistSongIds.length > 0 ? playlistSongIds : fallback.playlistBuilder.songIds,
    },
    rerankedSongIds: rerankedSongIds.length > 0 ? rerankedSongIds : fallback.rerankedSongIds,
    details: (detailSongId || detailArtistName || detailOriginTitle)
      ? { songId: detailSongId, artistName: detailArtistName, originTitle: detailOriginTitle }
      : null,
  };
}

function normalizeSongFeatureTokens(song) {
  const tokens = [];
  const add = (prefix, value) => {
    if (typeof value === 'string' && value.trim()) tokens.push(`${prefix}:${normalizeText(value)}`);
  };
  const addMany = (prefix, values) => {
    if (!Array.isArray(values)) return;
    values.forEach((value) => add(prefix, value));
  };

  add('genre', song.genre);
  add('language', song.language);
  add('artist', song.artist);
  add('album', song.originTitle || song.album);
  add('energy', song.energy);
  add('originType', song.originType);
  add('instrumental', song.isInstrumental ? 'yes' : 'no');
  addMany('mood', song.moods);
  addMany('activity', song.activities);
  addMany('time', song.timeOfDay);

  return tokens;
}

function buildRecommendationProfile(songs, likedSongIds = [], recentlyPlayedIds = [], currentSongId = null) {
  const idSet = new Set([...(likedSongIds || []), ...(recentlyPlayedIds || []), currentSongId].filter(Boolean));
  const profile = new Map();
  const seedSongs = [];

  songs.forEach((song) => {
    if (idSet.has(song.id)) {
      seedSongs.push(song);
    }
  });

  const addTokens = (song, weight) => {
    normalizeSongFeatureTokens(song).forEach((token) => {
      profile.set(token, (profile.get(token) ?? 0) + weight);
    });
  };

  seedSongs.forEach((song) => {
    const weight = song.id === currentSongId ? 4 : likedSongIds.includes(song.id) ? 3 : 1.5;
    addTokens(song, weight);
  });

  return { profile, seedSongs };
}

function cosineSimilarity(profile, candidateTokens) {
  if (!(profile instanceof Map) || profile.size === 0 || candidateTokens.length === 0) return 0;

  let dot = 0;
  let candidateMagnitude = 0;
  let profileMagnitude = 0;
  const candidateCounts = new Map();

  candidateTokens.forEach((token) => {
    candidateCounts.set(token, (candidateCounts.get(token) ?? 0) + 1);
  });

  candidateCounts.forEach((candidateCount, token) => {
    const profileWeight = profile.get(token) ?? 0;
    dot += candidateCount * profileWeight;
    candidateMagnitude += candidateCount ** 2;
  });

  profile.forEach((weight) => {
    profileMagnitude += weight ** 2;
  });

  if (candidateMagnitude === 0 || profileMagnitude === 0) return 0;
  return dot / (Math.sqrt(candidateMagnitude) * Math.sqrt(profileMagnitude));
}

function scoreRecommendationCandidate(candidate, profileSong) {
  let score = 0;
  const candidateTokens = normalizeSongFeatureTokens(candidate);
  score += cosineSimilarity(profileSong.profile, candidateTokens) * 100;

  profileSong.seedSongs.forEach((seed) => {
    if (seed.artist === candidate.artist) score += 20;
    if (seed.genre === candidate.genre) score += 12;
    if ((seed.language ?? '') === (candidate.language ?? '')) score += 8;
    if ((seed.originTitle || seed.album) === (candidate.originTitle || candidate.album)) score += 15;
    if (seed.energy === candidate.energy) score += 5;
    if (seed.isInstrumental === candidate.isInstrumental) score += 3;

    const moodOverlap = Array.isArray(seed.moods) && Array.isArray(candidate.moods)
      ? candidate.moods.filter((m) => seed.moods.includes(m)).length
      : 0;
    const activityOverlap = Array.isArray(seed.activities) && Array.isArray(candidate.activities)
      ? candidate.activities.filter((a) => seed.activities.includes(a)).length
      : 0;
    const timeOverlap = Array.isArray(seed.timeOfDay) && Array.isArray(candidate.timeOfDay)
      ? candidate.timeOfDay.filter((t) => seed.timeOfDay.includes(t)).length
      : 0;

    score += moodOverlap * 4;
    score += activityOverlap * 2;
    score += timeOverlap * 1.5;
  });

  return score;
}

async function rerankWithTrinity(candidates, profileSummary) {
  if (!openRouterApiKey || candidates.length === 0) return candidates;

  const response = await callOpenRouterJson({
    systemPrompt: [
      'You are Trinity, a music recommender.',
      'Return STRICT JSON only.',
      'Rank the provided candidate songs by how well they match the user profile.',
      'Only use the provided candidate ids.',
      'Return schema: { "songIds": ["id1","id2",...]}',
    ].join('\n'),
    userPayload: {
      profileSummary,
      candidates: candidates.map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        artist: candidate.artist,
        album: candidate.album,
        genre: candidate.genre,
        language: candidate.language,
        energy: candidate.energy,
        moods: candidate.moods,
        activities: candidate.activities,
        timeOfDay: candidate.timeOfDay,
        isInstrumental: candidate.isInstrumental,
      })),
    },
    temperature: 0.1,
  });

  const rankedIds = Array.isArray(response?.songIds)
    ? response.songIds.filter((id) => candidates.some((candidate) => candidate.id === id))
    : [];

  if (rankedIds.length === 0) return candidates;

  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const ranked = [];
  rankedIds.forEach((id) => {
    const item = candidateMap.get(id);
    if (item) {
      ranked.push(item);
      candidateMap.delete(id);
    }
  });

  return [...ranked, ...Array.from(candidateMap.values())];
}

async function recommendSongsFromCatalog({
  songs,
  likedSongIds = [],
  recentlyPlayedIds = [],
  currentSongId = null,
  limit = 8,
}) {
  const profile = buildRecommendationProfile(songs, likedSongIds, recentlyPlayedIds, currentSongId);
  const blockedIds = new Set([...(likedSongIds || []), ...(recentlyPlayedIds || []), currentSongId].filter(Boolean));
  const candidates = songs
    .filter((song) => !blockedIds.has(song.id))
    .map((song) => ({
      ...song,
      score: scoreRecommendationCandidate(song, profile),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(limit * 2, 20)));

  const profileSummary = {
    likedSongIds,
    recentlyPlayedIds,
    currentSongId,
    seedSongs: profile.seedSongs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      genre: song.genre,
      language: song.language,
      energy: song.energy,
    })),
  };

  const reranked = await rerankWithTrinity(candidates, profileSummary).catch(() => candidates);
  return {
    songIds: reranked.slice(0, limit).map((song) => song.id),
    source: openRouterApiKey ? 'hybrid-ml-trinity' : 'content-based-ml',
  };
}

app.use('/api', generalApiLimiter);

app.get('/api/health', (_req, res) => {
  const mailReady = Boolean(resendApiKey);
  const resetReady = Boolean(resendApiKey && supabaseUrl && supabaseServiceRoleKey);

  res.json({
    ok: true,
    apiVersion: 2,
    service: 'resend-api',
    mailReady,
    resetReady,
  });
});

app.post('/api/send-welcome', emailEndpointLimiter, async (req, res) => {
  try {
    if (!resendApiKey || !resend) {
      return res.status(500).json({ error: 'RESEND_API_KEY is not configured on server.' });
    }

    const { email, fullName } = req.body ?? {};

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    const safeName = typeof fullName === 'string' && fullName.trim() ? fullName.trim() : 'there';

    const { error } = await resend.emails.send({
      from: resendFromEmail,
      to: email,
      subject: 'Welcome to Whisky',
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h1 style="margin: 0 0 12px; color: #111111;">Welcome, ${safeName}</h1>
          <p style="margin: 0 0 10px; color: #333333; line-height: 1.6;">
            Your Whisky account is ready. Start discovering curated playlists and AI-powered recommendations.
          </p>
          <p style="margin: 0; color: #333333; line-height: 1.6;">Enjoy the music.</p>
        </div>
      `,
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error.';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/send-password-reset', passwordResetLimiter, async (req, res) => {
  try {
    if (!resendApiKey || !resend) {
      return res.status(500).json({ error: 'RESEND_API_KEY is not configured on server.' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin configuration is missing on server.' });
    }

    const { email } = req.body ?? {};

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: appUrl },
    });

    if (linkError || !data?.properties?.action_link) {
      return res.status(500).json({ error: 'Could not create password reset link.' });
    }

    const resetLink = data.properties.action_link;

    const { error: emailError } = await resend.emails.send({
      from: resendFromEmail,
      to: email,
      subject: 'Reset your Whisky password',
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h1 style="margin: 0 0 12px; color: #111111;">Password reset requested</h1>
          <p style="margin: 0 0 14px; color: #333333; line-height: 1.6;">
            Click the button below to reset your Whisky account password.
          </p>
          <a href="${resetLink}" style="display: inline-block; background: #1DB954; color: #0A0A0A; text-decoration: none; font-weight: 600; border-radius: 10px; padding: 12px 18px;">Reset Password</a>
          <p style="margin: 16px 0 0; color: #555555; line-height: 1.6; font-size: 14px;">
            If you did not request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (emailError) {
      return res.status(500).json({ error: emailError.message });
    }

    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error.';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/metadata/resolve', metadataLimiter, async (req, res) => {
  try {
    const { songTitle, artistName = '', spotifyScraper = null } = req.body ?? {};

    if (!songTitle || typeof songTitle !== 'string') {
      return res.status(400).json({ error: 'songTitle is required.' });
    }

    const metadata = await resolveMetadata({
      songTitle,
      artistName: typeof artistName === 'string' ? artistName : '',
      spotifyScraper,
    });

    if (!metadata) {
      return res.status(404).json({ error: 'No metadata found for this song.' });
    }

    return res.json({ metadata });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error.';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/recommendations', aiLimiter, async (req, res) => {
  try {
    const { catalog, likedSongIds = [], recentlyPlayedIds = [], currentSongId = null, limit = 8 } = req.body ?? {};

    if (!catalog || typeof catalog !== 'object' || !Array.isArray(catalog.songs)) {
      return res.status(400).json({ error: 'Catalog payload is required.' });
    }

    const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 12));
    const result = await recommendSongsFromYouTube({
      songs: catalog.songs,
      likedSongIds: Array.isArray(likedSongIds) ? likedSongIds : [],
      recentlyPlayedIds: Array.isArray(recentlyPlayedIds) ? recentlyPlayedIds : [],
      currentSongId: typeof currentSongId === 'string' ? currentSongId : null,
      limit: safeLimit,
    });

    return res.json({
      ...result,
      songs: Array.isArray(result.songs) ? result.songs : [],
      songIds: Array.isArray(result.songIds) ? result.songIds : [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error.';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/recommendation-history', generalApiLimiter, async (req, res) => {
  try {
    const { eventType, songId, likedSongIds = [], recentlyPlayedIds = [], currentSongId = null } = req.body ?? {};

    if (eventType !== 'play' && eventType !== 'like') {
      return res.status(400).json({ error: 'eventType must be play or like.' });
    }

    if (!songId || typeof songId !== 'string') {
      return res.status(400).json({ error: 'songId is required.' });
    }

    await appendRecommendationHistory({
      eventType,
      songId,
      likedSongIds: Array.isArray(likedSongIds) ? likedSongIds.filter((id) => typeof id === 'string') : [],
      recentlyPlayedIds: Array.isArray(recentlyPlayedIds) ? recentlyPlayedIds.filter((id) => typeof id === 'string') : [],
      currentSongId: typeof currentSongId === 'string' ? currentSongId : null,
    });

    return res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error.';
    return res.status(500).json({ error: message });
  }
});

// Resolve an alternate videoId for a given song when the originally returned one
// is blocked by embed restrictions. We re-query YT Music and skip any IDs the
// client has already tried; the client will keep asking until we run out.
app.get('/api/resolve-alt', async (req, res) => {
  const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
  const artist = typeof req.query.artist === 'string' ? req.query.artist.trim() : '';
  const excludeRaw = typeof req.query.exclude === 'string' ? req.query.exclude : '';
  const exclude = new Set(excludeRaw.split(',').map((s) => s.trim()).filter(Boolean));
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    await ensureYtMusicReady();
    const query = `${title} ${artist}`.trim();
    // Pull more results than usual so we have something to try after a few failures.
    const results = await ytmusic.searchSongs(query);
    if (Array.isArray(results)) {
      for (const candidate of results.slice(0, 15)) {
        if (!candidate?.videoId) continue;
        if (exclude.has(candidate.videoId)) continue;
        if (!(await isVideoEmbeddable(candidate.videoId))) continue;
        return res.json({ videoId: candidate.videoId, source: 'ytmusic' });
      }
    }
    // Last-resort: HTML scraper, even though it sometimes returns non-embeddable
    // music videos. Better than nothing.
    const htmlVid = await searchYouTubeHtmlForSong(title, artist);
    if (htmlVid && !exclude.has(htmlVid) && (await isVideoEmbeddable(htmlVid))) {
      return res.json({ videoId: htmlVid, source: 'html' });
    }
    // Always 200 — the client distinguishes "endpoint missing" from "no result" by
    // checking whether videoId is null. 404 here gets misread as a route bug.
    return res.json({ videoId: null, source: 'none' });
  } catch (err) {
    return res.status(500).json({ error: err && err.message ? err.message : 'lookup failed' });
  }
});

// Cache extracted audio URLs — googlevideo URLs expire after a few hours, so cap TTL
// well below that. Avoids re-running yt-dlp for the same videoId on every play.
const audioUrlCache = new Map();
const AUDIO_URL_TTL_MS = 90 * 60 * 1000; // 90 min, googlevideo signs expire ~6h

function resolveYtDlpPath() {
  const candidates = [
    process.env.YTDLP_PATH,
    path.join(process.resourcesPath || '', 'yt-dlp.exe'),
    path.join(process.cwd(), 'build', 'yt-dlp.exe'),
    path.join(process.cwd(), 'yt-dlp.exe'),
  ].filter(Boolean);
  for (const p of candidates) {
    try { if (p && require('node:fs').existsSync(p)) return p; } catch { /* skip */ }
  }
  return 'yt-dlp'; // assume on PATH
}

async function extractAudioUrlViaYtDlp(videoId) {
  const cached = audioUrlCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const ytdlpPath = resolveYtDlpPath();
  return new Promise((resolve) => {
    const { spawn } = require('node:child_process');
    const args = [
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '--get-url',
      '--no-warnings',
      '--no-playlist',
      `https://www.youtube.com/watch?v=${videoId}`,
    ];
    const proc = spawn(ytdlpPath, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    const timer = setTimeout(() => { try { proc.kill(); } catch { /* ignore */ } }, 12000);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 || !stdout.trim()) {
        console.warn('[yt-dlp] failed', videoId, 'code', code, 'stderr', stderr.slice(0, 200));
        return resolve(null);
      }
      const url = stdout.trim().split('\n')[0];
      audioUrlCache.set(videoId, { url, expiresAt: Date.now() + AUDIO_URL_TTL_MS });
      console.log('[yt-dlp] hit', videoId);
      resolve(url);
    });
    proc.on('error', () => { clearTimeout(timer); resolve(null); });
  });
}

app.get('/api/audio-stream', async (req, res) => {
  try {
    const videoId = req.query.videoId;
    if (!videoId || typeof videoId !== 'string') {
      return res.status(400).json({ error: 'videoId query parameter is required.' });
    }

    const url = await extractAudioUrlViaYtDlp(videoId);
    if (!url) {
      return res.status(404).json({ error: 'Audio stream URL not found.' });
    }

    return res.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error.';
    return res.status(500).json({ error: message });
  }
});

// YT Music search — returns music-only results and incorporates relatedness/popularity
// signal that iTunes search lacks. Used to enrich the recommendation candidate pool.
const ytmusicSearchCache = new Map();
const YTMUSIC_SEARCH_TTL_MS = 30 * 60 * 1000;

app.post('/api/search/ytmusic', searchLimiter, async (req, res) => {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    const limit = Math.max(1, Math.min(Number(req.body?.limit) || 8, 20));
    if (!query) return res.status(400).json({ error: 'query is required' });

    const cacheKey = `${query.toLowerCase()}|${limit}`;
    const cached = ytmusicSearchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ source: 'ytmusic-cache', results: cached.results });
    }

    await ensureYtMusicReady();
    const raw = await ytmusic.searchSongs(query);
    if (!Array.isArray(raw)) return res.json({ source: 'ytmusic', results: [] });

    const results = raw.slice(0, limit).map((s) => {
      const cover = s.thumbnails?.[s.thumbnails.length - 1]?.url
        || s.thumbnails?.[0]?.url
        || '';
      const artistName = s.artist?.name || s.artists?.[0]?.name || 'Unknown Artist';
      return {
        id: `ytmusic-${s.videoId}`,
        title: s.name || 'Unknown',
        artist: artistName,
        album: s.album?.name || '',
        coverUrl: cover,
        duration: s.duration || 0,
        isLiked: false,
        videoId: s.videoId,
        genre: '',
        releaseYear: undefined,
        country: '',
      };
    }).filter((s) => s.videoId);

    ytmusicSearchCache.set(cacheKey, { results, expiresAt: Date.now() + YTMUSIC_SEARCH_TTL_MS });
    return res.json({ source: 'ytmusic', results });
  } catch (err) {
    return res.status(500).json({ error: err && err.message ? err.message : 'ytmusic search failed' });
  }
});

app.post('/api/search/songs', searchLimiter, async (req, res) => {
  console.log('[API] Incoming search request:', req.body);
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      console.warn('[API] Missing YOUTUBE_API_KEY');
    }
    const { query, limit = 12, country = '' } = req.body ?? {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required.' });
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      return res.json({ source: 'none', results: [] });
    }

    const safeLimit = Math.max(1, Math.min(Number(limit) || 12, 24));
    const safeCountry = typeof country === 'string' ? country.trim() : '';
    let results = await fetchItunesSearchResults(normalizedQuery, safeLimit, safeCountry);
    if (!results || results.length === 0) {
      console.warn('[API] No iTunes results for query:', normalizedQuery);
      return res.json({ source: 'itunes', results: [] });
    }
    results = await attachYouTubeIdsToSongs(results);
    // Filter out nulls and ensure every song has a videoId
    results = results.filter(song => song && song.videoId);
    if (!results.length) {
      console.warn('[API] No enriched results with videoId for query:', normalizedQuery);
      return res.json({ source: 'itunes', results: [] });
    }
    console.log('[API] Final search results:', results);
    return res.json({ source: 'itunes', results });
  } catch (error) {
    console.error('SEARCH API ERROR:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
});

app.post('/api/ai-curator', aiLimiter, async (req, res) => {
  try {
    const { prompt, catalog, searchResultSongIds } = req.body ?? {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'A text prompt is required.' });
    }

    if (!catalog || typeof catalog !== 'object' || !Array.isArray(catalog.songs) || !Array.isArray(catalog.playlists)) {
      return res.status(400).json({ error: 'Catalog payload is required.' });
    }

    const songs = catalog.songs;
    const playlists = catalog.playlists;
    const resultSet = Array.isArray(searchResultSongIds)
      ? songs.filter((song) => searchResultSongIds.includes(song.id))
      : [];

    const fallback = heuristicCurator(prompt, songs, playlists, resultSet, catalog.albums ?? []);

    let metadataPromptContext = null;
    let serpPromptContext = null;
    const promptMatch = songs.find((song) => normalizeText(prompt).includes(normalizeText(song.title)));
    if (promptMatch) {
      try {
        metadataPromptContext = await resolveMetadata({
          songTitle: promptMatch.title,
          artistName: promptMatch.artist,
        });
      } catch {
        metadataPromptContext = null;
      }
    }

    if (serpApiKey) {
      try {
        const serpResults = await fetchSerpSearchResults(prompt);
        serpPromptContext = serpResults.slice(0, 5).map((item) => ({
          title: stripHtmlTags(item?.title ?? ''),
          link: typeof item?.link === 'string' ? item.link : '',
          snippet: stripHtmlTags(item?.snippet ?? ''),
        }));
      } catch {
        serpPromptContext = null;
      }
    }

    if (!openRouterApiKey) {
      return res.json({ ...fallback, model: 'heuristic-fallback' });
    }

    const systemPrompt = [
      'You are an AI music curator for Whisky Music.',
      'Only recommend songs, playlists, and albums from the provided catalog.',
      'Return STRICT JSON only, no markdown.',
      'Support: intent understanding, smart playlist builder, conversational reranking, and detail lookup.',
      'JSON schema:',
      '{',
      '  "intent": "string",',
      '  "responseText": "string",',
      '  "suggestions": [{"type":"song|playlist|album","id":"string","reason":"short reason"}],',
      '  "playlistBuilder": {"name":"string","description":"string","songIds":["id1","id2"]},',
      '  "rerankedSongIds": ["songId1","songId2"],',
      '  "details": {"songId":"optional string","artistName":"optional string","originTitle":"optional string"}',
      '}',
      'Never invent ids that do not exist in the catalog.',
    ].join('\n');

    const response = await fetch(`${openRouterBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: openRouterModel,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: JSON.stringify({
              prompt,
              searchResultSongIds: Array.isArray(searchResultSongIds) ? searchResultSongIds : [],
              catalog,
              metadataPromptContext,
              serpPromptContext,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return res.json({ ...fallback, model: 'heuristic-fallback' });
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content ?? '';
    const parsed = extractJsonObject(content);
    const result = sanitizeAiResult(parsed, songs, playlists, fallback);

    let metadataDetails = null;
    if (result.details?.songId) {
      const detailSong = songs.find((song) => song.id === result.details.songId);
      if (detailSong) {
        try {
          metadataDetails = await resolveMetadata({
            songTitle: detailSong.title,
            artistName: detailSong.artist,
          });
        } catch {
          metadataDetails = null;
        }
      }
    }

    return res.json({
      ...result,
      metadataDetails,
      model: openRouterModel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error.';
    return res.status(500).json({ error: message });
  }
});

function compactSong(song) {
  if (!song || typeof song !== 'object') return null;
  return {
    title: typeof song.title === 'string' ? song.title : '',
    artist: typeof song.artist === 'string' ? song.artist : '',
    genre: typeof song.genre === 'string' ? song.genre : '',
    year: typeof song.releaseYear === 'number' ? song.releaseYear : null,
  };
}

app.post('/api/ai-curator/chat', aiLimiter, async (req, res) => {
  try {
    const {
      prompt,
      currentSong = null,
      likedSongs = [],
      recentSongs = [],
      preferredLanguages = [],
      responseLanguage = 'English',
    } = req.body ?? {};
    const safeResponseLanguage = responseLanguage === 'Hindi' ? 'Hindi' : 'English';

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 2) {
      return res.status(400).json({ error: 'A prompt is required.' });
    }

    if (!openRouterApiKey) {
      return res.status(503).json({
        error: 'AI curator is not configured. Add OPENROUTER_API_KEY to your environment.',
      });
    }

    const compactCurrent = compactSong(currentSong);
    const compactLiked = Array.isArray(likedSongs) ? likedSongs.slice(0, 12).map(compactSong).filter(Boolean) : [];
    const compactRecent = Array.isArray(recentSongs) ? recentSongs.slice(0, 12).map(compactSong).filter(Boolean) : [];

    const systemPrompt = [
      'You are a friendly and knowledgeable music curator named "Whisky".',
      `Respond ONLY in ${safeResponseLanguage}. ${
        safeResponseLanguage === 'Hindi'
          ? 'Use natural conversational Hindi in Devanagari script for responseText, facts, and the playlist name and description. Keep proper nouns (artist names, song titles) in their original spelling — do NOT transliterate them. Use Hinglish only if a word has no common Devanagari equivalent.'
          : 'Use natural conversational English.'
      }`,
      'You ONLY discuss music, songs, artists, albums, genres, music history, music industry, soundtracks, and movies/films when relevant to their soundtrack or featured songs.',
      'You DO NOT answer questions outside of these topics. If a user asks anything off-topic (general trivia, news, math, code, personal advice, weather, politics, religion, etc.), respond politely declining and steer them back to music with an example question.',
      'Return STRICT JSON only — no markdown fences, no commentary outside the JSON.',
      'Schema:',
      '{',
      '  "intent": "facts" | "playlist" | "explain" | "chat" | "off_topic",',
      '  "responseText": "2-4 friendly sentences answering the user. Plain text, no JSON.",',
      '  "facts": ["fact 1", "fact 2", "fact 3"],',
      '  "playlist": {',
      '    "name": "Short evocative playlist name",',
      '    "description": "1-2 sentence description",',
      '    "tracks": [ {"title": "Song Title", "artist": "Artist Name", "reason": "why it fits"} ]',
      '  } | null',
      '}',
      'Rules:',
      '- Use intent="off_topic" if the user asks anything outside of music, songs, artists, albums, soundtracks, or films-as-music. responseText should briefly decline and offer 2 sample music questions. facts=[], playlist=null.',
      '- Use "facts" with 3-5 specific, true, interesting facts about an artist, song, album, music genre, or movie soundtrack the user asks about. Never invent facts. If unsure, leave facts empty and explain that in responseText.',
      '- Use "playlist" with 8-12 real, popular songs by named real artists when the user wants a mix, vibe, recommendation, or movie-soundtrack-style mix. Mix well-known and adjacent picks. Match the user\'s preferred languages and the current/recent listening when context is given.',
      '- Movies/films are in scope ONLY for their music: soundtrack, score, featured songs, composer, music director, playback singers. Decline questions about plot, cast, reviews, etc.',
      '- For chit-chat or short music clarifications, set facts=[] and playlist=null.',
      '- Never include track ids — only title and artist as the listener would type them.',
      '- Keep responseText warm, concrete, and short.',
    ].join('\n');

    const userPayload = {
      prompt,
      preferredLanguages,
      currentSong: compactCurrent,
      likedSongs: compactLiked,
      recentSongs: compactRecent,
    };

    let parsed = null;
    try {
      const response = await fetch(`${openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': appUrl,
          'X-Title': 'Whisky Music',
        },
        body: JSON.stringify({
          model: openRouterModel,
          temperature: 0.55,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(userPayload) },
          ],
        }),
      });

      if (response.ok) {
        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content ?? '';
        parsed = extractJsonObject(content);
      } else {
        const errorBody = await response.text().catch(() => '');
        console.warn(
          '[ai-curator/chat] OpenRouter response not ok:',
          response.status,
          'model=', openRouterModel,
          'keyHasValue=', Boolean(openRouterApiKey),
          'body=', errorBody.slice(0, 400),
        );
      }
    } catch (err) {
      console.error('[ai-curator/chat] OpenRouter error:', err);
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.json({
        intent: 'chat',
        responseText: 'I had trouble reaching the music brain just now. Try again in a moment.',
        facts: [],
        playlist: null,
        model: 'fallback',
      });
    }

    const intent = typeof parsed.intent === 'string' ? parsed.intent : 'chat';
    const responseText = typeof parsed.responseText === 'string' ? parsed.responseText : '';
    const facts = Array.isArray(parsed.facts)
      ? parsed.facts.filter((entry) => typeof entry === 'string' && entry.trim().length > 0).slice(0, 6)
      : [];

    let playlist = null;
    if (parsed.playlist && typeof parsed.playlist === 'object' && Array.isArray(parsed.playlist.tracks)) {
      const rawTracks = parsed.playlist.tracks
        .filter((t) => t && typeof t === 'object' && typeof t.title === 'string' && typeof t.artist === 'string')
        .slice(0, 12);

      const country = (() => {
        const langs = Array.isArray(preferredLanguages) ? preferredLanguages : [];
        if (langs.includes('Hindi') || langs.includes('Punjabi') || langs.includes('Tamil') || langs.includes('Telugu')) return 'in';
        if (langs.includes('Korean')) return 'kr';
        if (langs.includes('Japanese')) return 'jp';
        if (langs.includes('Spanish')) return 'mx';
        if (langs.includes('French')) return 'fr';
        return '';
      })();

      const resolved = await Promise.all(
        rawTracks.map(async (track) => {
          const query = `${track.title} ${track.artist}`.trim();
          const itunes = await fetchItunesSearchResults(query, 1, country);
          const enriched = await attachYouTubeIdsToSongs(itunes);
          const song = enriched.find((s) => s && s.videoId) || null;
          if (!song) return null;
          return {
            ...song,
            reason: typeof track.reason === 'string' ? track.reason : '',
          };
        }),
      );

      const tracks = resolved.filter(Boolean);
      if (tracks.length > 0) {
        playlist = {
          name: typeof parsed.playlist.name === 'string' ? parsed.playlist.name : 'Whisky Mix',
          description: typeof parsed.playlist.description === 'string' ? parsed.playlist.description : '',
          tracks,
        };
      }
    }

    return res.json({
      intent,
      responseText,
      facts,
      playlist,
      model: openRouterModel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error.';
    return res.status(500).json({ error: message });
  }
});

// Serve the packaged UI from this server when WHISKY_STATIC_DIR is set so the renderer
// loads from http://localhost (a real http origin) instead of file:// — required for the
// YouTube IFrame postMessage handshake to accept play/pause commands.
const staticDir = process.env.WHISKY_STATIC_DIR;
if (staticDir) {
  const expressMod = await import('express');
  const expressLib = expressMod.default || expressMod;
  app.use(expressLib.static(staticDir, { fallthrough: true, index: 'index.html' }));
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(staticDir, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

app.listen(port, () => {
  console.log(`[resend-api] Listening on http://localhost:${port}`);
  if (staticDir) console.log(`[resend-api] Serving UI from ${staticDir}`);
  console.log('[resend-api] Config summary:', {
    appUrl,
    resendFromEmail,
    hasResendApiKey: Boolean(resendApiKey),
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasSupabaseServiceRoleKey: Boolean(supabaseServiceRoleKey),
    hasOpenRouterApiKey: Boolean(openRouterApiKey),
    metadataProvider,
    metadataFallbackEnabled,
    hasYtMusicProviderUrl: Boolean(ytmusicProviderUrl),
    ytmusicProviderTimeoutMs,
    searchProvider,
    searchFallbackEnabled,
    hasYtMusicSearchUrl: Boolean(ytmusicSearchUrl),
    ytmusicSearchTimeoutMs,
    itunesSearchEnabled,
  });
  console.log('[resend-api] Active rate limits:', {
    api: { windowMs: apiRateLimitWindowMs, maxRequests: apiRateLimitMax },
    email: { windowMs: emailRateLimitWindowMs, maxRequests: emailRateLimitMax },
    passwordReset: { windowMs: resetRateLimitWindowMs, maxRequests: resetRateLimitMax },
    aiCurator: { windowMs: aiRateLimitWindowMs, maxRequests: aiRateLimitMax },
    metadata: { windowMs: metadataRateLimitWindowMs, maxRequests: metadataRateLimitMax },
    search: { windowMs: searchRateLimitWindowMs, maxRequests: searchRateLimitMax },
  });
});

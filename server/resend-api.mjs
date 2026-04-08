
import dotenv from 'dotenv';
dotenv.config();
import YTMusic from 'ytmusic-api';
const ytmusic = new YTMusic();
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

async function searchYouTubeForSong(title, artist) {
  const key = `${title.toLowerCase().trim()}|${artist.toLowerCase().trim()}`;
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
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`
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
    videoId = await searchYouTubeHtmlForSong(title, artist);
  }

  youtubeCache.set(key, { videoId, ts: now });
  return videoId;
}

async function attachYouTubeIdsToSongs(songs) {
  const results = [];
  for (const song of songs) {
    if (!song.videoId) {
      const videoId = await searchYouTubeForSong(song.title, song.artist);
      if (!videoId) {
        console.warn('[YouTubeEnrich] No videoId found for', song.title, '-', song.artist);
      }
      results.push({ ...song, videoId });
    } else {
      results.push(song);
    }
  }
  console.log('[YouTubeEnrich] Final enriched results:', results);
  return results;
}
import 'dotenv/config';
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
const geniusRateLimitWindowMs = Number(process.env.GENIUS_RATE_LIMIT_WINDOW_MS ?? 60_000);
const geniusRateLimitMax = Number(process.env.GENIUS_RATE_LIMIT_MAX ?? 30);
const metadataRateLimitWindowMs = Number(process.env.METADATA_RATE_LIMIT_WINDOW_MS ?? 60_000);
const metadataRateLimitMax = Number(process.env.METADATA_RATE_LIMIT_MAX ?? 30);
const searchRateLimitWindowMs = Number(process.env.SEARCH_RATE_LIMIT_WINDOW_MS ?? 60_000);
const searchRateLimitMax = Number(process.env.SEARCH_RATE_LIMIT_MAX ?? 30);
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const openRouterModel = process.env.OPENROUTER_MODEL ?? 'arcee-ai/trinity-large-preview';
const openRouterBaseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
const geniusAccessToken = process.env.GENIUS_ACCESS_TOKEN;
const geniusBaseUrl = process.env.GENIUS_BASE_URL ?? 'https://api.genius.com';
const metadataProvider = (process.env.METADATA_PROVIDER ?? 'auto').toLowerCase();
const metadataFallbackEnabled = (process.env.METADATA_FALLBACK_ENABLED ?? 'true').toLowerCase() !== 'false';
const googleCustomSearchApiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
const googleCustomSearchCx = process.env.GOOGLE_CUSTOM_SEARCH_CX;
const googleMetadataEnabled = Boolean(googleCustomSearchApiKey && googleCustomSearchCx);
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
const geniusLimiter = createRateLimit({
  windowMs: geniusRateLimitWindowMs,
  maxRequests: geniusRateLimitMax,
});
const metadataLimiter = createRateLimit({
  windowMs: metadataRateLimitWindowMs,
  maxRequests: metadataRateLimitMax,
});
const searchLimiter = createRateLimit({
  windowMs: searchRateLimitWindowMs,
  maxRequests: searchRateLimitMax,
});

const geniusMetadataCache = new Map();

function normalizeText(value) {
  return (value ?? '').toString().trim().toLowerCase();
}

function extractPlainText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value?.plain === 'string') return value.plain;
  return '';
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

  const title = firstDefinedString(item.title, item.trackName, item.name) || 'Unknown Title';
  const artist = firstDefinedString(item.artist, item.artistName, item.artistDisplayName) || 'Unknown Artist';
  const album = firstDefinedString(item.album, item.albumName, item.collectionName, item.releaseName) || 'Single';

  // Upgrade iTunes artwork to high-res
  let coverUrl = firstDefinedString(
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
    source === 'ytmusic' ? item.id : '',
  );
  const preferredId = firstDefinedString(item.id, item.videoId, item.trackId);
  const id = preferredId || `ext-${source}-${normalizeText(title)}-${normalizeText(artist)}`;

  return {
    id,
    title,
    artist,
    album,
    coverUrl,
    duration,
    isLiked: false,
    videoId: videoId || undefined,
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

async function fetchItunesSearchResults(query, limit = 12) {
  if (!itunesSearchEnabled) {
    return [];
  }

  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', query);
  url.searchParams.set('entity', 'song');
  url.searchParams.set('limit', String(Math.max(1, Math.min(limit, 25))));

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return [];

    const payload = await response.json().catch(() => null);
    const results = toArray(payload?.results);
    return results
      .slice(0, limit)
      .map((item) => normalizeSearchSong(item, 'itunes'))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function resolveSongSearch(query, limit = 12) {
  const providerOrder = (() => {
    const selected = searchProvider === 'ytmusic' || searchProvider === 'itunes'
      ? searchProvider
      : 'auto';

    if (selected === 'ytmusic') {
      return searchFallbackEnabled ? ['ytmusic', 'itunes'] : ['ytmusic'];
    }
    if (selected === 'itunes') {
      return searchFallbackEnabled ? ['itunes', 'ytmusic'] : ['itunes'];
    }
    return searchFallbackEnabled ? ['ytmusic', 'itunes'] : ['ytmusic'];
  })();

  let resolvedSource = 'none';

  for (const provider of providerOrder) {
    let results = provider === 'ytmusic'
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
    geniusUrl: spotifyUrl || null,
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
    geniusUrl: firstDefinedString(payload?.sourceUrl, payload?.ytmusicUrl, payload?.url, payload?.watchUrl) || null,
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

// FIX: geniusRequest had an unclosed forEach loop. Added missing closing braces.
async function geniusRequest(pathname, queryParams = {}) {
  if (!geniusAccessToken) {
    throw new Error('GENIUS_ACCESS_TOKEN is not configured on server.');
  }

  const url = new URL(`${geniusBaseUrl}${pathname}`);

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }); // FIX: was missing closing }); for forEach

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${geniusAccessToken}`,
      Accept: 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.meta?.status >= 400) {
    const message = payload?.meta?.message || 'Genius request failed.';
    throw new Error(message);
  }

  return payload?.response;
}

async function fetchGeniusMetadata(songTitle, artistName = '') {
  const cacheKey = `${normalizeText(songTitle)}|${normalizeText(artistName)}`;
  const cached = geniusMetadataCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const query = [songTitle, artistName].filter(Boolean).join(' ').trim();
  if (!query) return null;

  const search = await geniusRequest('/search', { q: query });
  const hits = Array.isArray(search?.hits) ? search.hits : [];
  const songHits = hits.filter((hit) => hit?.type === 'song').map((hit) => hit.result).filter(Boolean);

  const preferred = songHits.find((result) => {
    if (!artistName) {
      return normalizeText(result?.title).includes(normalizeText(songTitle));
    }
    return normalizeText(result?.primary_artist?.name).includes(normalizeText(artistName));
  }) || songHits[0];

  if (!preferred?.id) return null;

  const songResponse = await geniusRequest(`/songs/${preferred.id}`, { text_format: 'plain' });
  const song = songResponse?.song;

  const artistId = song?.primary_artist?.id;
  let artist = null;
  if (artistId) {
    const artistResponse = await geniusRequest(`/artists/${artistId}`, { text_format: 'plain' });
    artist = artistResponse?.artist ?? null;
  }

  const referentsResponse = await geniusRequest('/referents', {
    song_id: preferred.id,
    per_page: 5,
    text_format: 'plain',
  });

  const referents = Array.isArray(referentsResponse?.referents) ? referentsResponse.referents : [];
  const annotations = referents
    .flatMap((referent) => {
      const body = referent?.annotations?.[0]?.body;
      const note = extractPlainText(body).trim();
      const fragment = referent?.fragment || '';
      if (!note) return [];
      return [{ fragment, note }];
    })
    .slice(0, 3);

  const metadata = {
    songId: String(song?.id ?? preferred.id),
    title: song?.title ?? preferred.title ?? songTitle,
    fullTitle: song?.full_title ?? preferred.full_title ?? '',
    artistName: song?.primary_artist?.name ?? preferred?.primary_artist?.name ?? artistName,
    artistId: artist?.id ? String(artist.id) : null,
    artistImageUrl: artist?.image_url ?? null,
    artistDescription: extractPlainText(artist?.description).slice(0, 500),
    songDescription: extractPlainText(song?.description).slice(0, 700),
    albumName: song?.album?.name ?? null,
    releaseDate: song?.release_date_for_display ?? null,
    geniusUrl: song?.url ?? preferred?.url ?? null,
    annotationCount: referents.length,
    topAnnotations: annotations,
  };

  geniusMetadataCache.set(cacheKey, {
    data: metadata,
    expiresAt: now + 30 * 60_000,
  });

  return metadata;
}

async function fetchGoogleSearchResults(query) {
  if (!googleMetadataEnabled) return [];

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', googleCustomSearchApiKey);
  url.searchParams.set('cx', googleCustomSearchCx);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '5');

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => null);
  return Array.isArray(payload?.items) ? payload.items : [];
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

async function fetchGoogleMetadata(songTitle, artistName = '') {
  const cacheKey = `${normalizeText(songTitle)}|${normalizeText(artistName)}`;
  const cached = geniusMetadataCache.get(`google:${cacheKey}`);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const query = [songTitle, artistName].filter(Boolean).join(' ').trim();
  if (!query || !googleMetadataEnabled) return null;

  const metadataResults = await fetchGoogleSearchResults(`${query} wikipedia genre language year`);
  const lyricsResults = await fetchGoogleSearchResults(`${query} lyrics`);
  if (metadataResults.length === 0 && lyricsResults.length === 0) return null;

  const sources = {
    metadata: metadataResults.slice(0, 5).map((item) => ({
      title: stripHtmlTags(item?.title ?? ''),
      link: typeof item?.link === 'string' ? item.link : '',
      snippet: stripHtmlTags(item?.snippet ?? ''),
    })),
    lyrics: lyricsResults.slice(0, 5).map((item) => ({
      title: stripHtmlTags(item?.title ?? ''),
      link: typeof item?.link === 'string' ? item.link : '',
      snippet: stripHtmlTags(item?.snippet ?? ''),
    })),
  };

  const modelResponse = await callOpenRouterJson({
    systemPrompt: [
      'You are Trinity, a music metadata extractor.',
      'You receive Google search results and must return STRICT JSON only.',
      'Use only the provided sources. Do not invent facts.',
      'For lyrics, never output full copyrighted lyrics.',
      'Return at most a short lyric excerpt of 1-2 short lines if it is directly supported by the snippets. Otherwise use null.',
      'Schema:',
      '{',
      '  "genre": "string|null",',
      '  "language": "string|null",',
      '  "originYear": "number|null",',
      '  "songDescription": "string|null",',
      '  "sourceUrl": "string|null",',
      '  "artistName": "string|null",',
      '  "title": "string|null"',
      '}',
      'Prefer Wikipedia or official sources for metadata.',
    ].join('\n'),
    userPayload: { songTitle, artistName, sources },
  });

  const bestSourceUrl = modelResponse?.sourceUrl
    || sources.metadata[0]?.link
    || sources.lyrics[0]?.link
    || null;

  const fallbackSnippet = sources.metadata[0]?.snippet || sources.lyrics[0]?.snippet || '';
  const metadata = {
    source: 'google',
    songId: `${normalizeText(songTitle)}|${normalizeText(artistName)}` || songTitle,
    title: typeof modelResponse?.title === 'string' && modelResponse.title.trim() ? modelResponse.title.trim() : songTitle,
    fullTitle: artistName ? `${songTitle} by ${artistName}` : songTitle,
    artistName: typeof modelResponse?.artistName === 'string' && modelResponse.artistName.trim()
      ? modelResponse.artistName.trim()
      : artistName || 'Unknown Artist',
    artistId: null,
    artistImageUrl: null,
    artistDescription: '',
    songDescription: typeof modelResponse?.songDescription === 'string' && modelResponse.songDescription.trim()
      ? modelResponse.songDescription.trim()
      : fallbackSnippet,
    albumName: null,
    releaseDate: typeof modelResponse?.originYear === 'number' ? String(modelResponse.originYear) : null,
    geniusUrl: typeof bestSourceUrl === 'string' && bestSourceUrl.trim() ? bestSourceUrl : null,
    annotationCount: 0,
    topAnnotations: [],
    genre: typeof modelResponse?.genre === 'string' && modelResponse.genre.trim() ? modelResponse.genre.trim() : null,
    language: typeof modelResponse?.language === 'string' && modelResponse.language.trim() ? modelResponse.language.trim() : null,
    originYear: typeof modelResponse?.originYear === 'number' ? modelResponse.originYear : null,
  };

  if (!metadata.genre || !metadata.language || !metadata.originYear || !metadata.songDescription) {
    metadata.genre ||= null;
    metadata.language ||= null;
    metadata.originYear ||= null;
    metadata.songDescription ||= fallbackSnippet;
  }

  geniusMetadataCache.set(`google:${cacheKey}`, {
    data: metadata,
    expiresAt: now + 30 * 60_000,
  });

  return metadata;
}

async function resolveMetadata({ songTitle, artistName = '', spotifyScraper = null }) {
  const adaptedSpotify = normalizeSpotifyScraperMetadata(songTitle, artistName, spotifyScraper);
  if (adaptedSpotify) return adaptedSpotify;

  const providerOrder = (() => {
    const selected = metadataProvider === 'ytmusic' || metadataProvider === 'genius' || metadataProvider === 'google'
      ? metadataProvider
      : 'auto';

    if (selected === 'google') {
      return googleMetadataEnabled
        ? ['google', 'genius', 'ytmusic']
        : ['genius', 'ytmusic'];
    }
    if (selected === 'ytmusic') {
      return metadataFallbackEnabled ? ['ytmusic', 'google', 'genius'] : ['ytmusic'];
    }
    if (selected === 'genius') {
      return metadataFallbackEnabled ? ['genius', 'google', 'ytmusic'] : ['genius'];
    }
    if (googleMetadataEnabled) {
      return metadataFallbackEnabled ? ['google', 'genius', 'ytmusic'] : ['google'];
    }
    return metadataFallbackEnabled ? ['genius', 'ytmusic'] : ['genius'];
  })();

  for (const provider of providerOrder) {
    if (provider === 'google') {
      const googleMetadata = await fetchGoogleMetadata(songTitle, artistName).catch(() => null);
      if (googleMetadata) {
        return googleMetadata;
      }
      continue;
    }

    if (provider === 'genius') {
      const geniusMetadata = await fetchGeniusMetadata(songTitle, artistName).catch(() => null);
      if (geniusMetadata) {
        return { ...geniusMetadata, source: 'genius' };
      }
      continue;
    }

    if (provider === 'ytmusic') {
      const ytmusicMetadata = await fetchYtMusicMetadata(songTitle, artistName);
      if (ytmusicMetadata) return ytmusicMetadata;
    }
  }

  return null;
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

app.get('/api/genius/metadata', geniusLimiter, async (req, res) => {
  try {
    const songTitle = req.query.songTitle;
    const artistName = req.query.artistName;

    if (!songTitle || typeof songTitle !== 'string') {
      return res.status(400).json({ error: 'songTitle query parameter is required.' });
    }

    const metadata = await resolveMetadata({
      songTitle,
      artistName: typeof artistName === 'string' ? artistName : '',
    });

    if (!metadata) {
      return res.status(404).json({ error: 'No Genius metadata found for this song.' });
    }

    return res.json({ metadata });
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
    const result = await recommendSongsFromCatalog({
      songs: catalog.songs,
      likedSongIds: Array.isArray(likedSongIds) ? likedSongIds : [],
      recentlyPlayedIds: Array.isArray(recentlyPlayedIds) ? recentlyPlayedIds : [],
      currentSongId: typeof currentSongId === 'string' ? currentSongId : null,
      limit: safeLimit,
    });

    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error.';
    return res.status(500).json({ error: message });
  }
});

async function getYouTubeAudioUrl(videoId) {
  try {
    await ytmusic.initialize();
    const song = await ytmusic.getSong(videoId);
    const url = song?.formats?.[0]?.url || song?.adaptiveFormats?.[0]?.url || null;
    return url;
  } catch (error) {
    console.error('[API] Audio URL fetch failed:', error);
    return null;
  }
}

app.get('/api/audio-stream', async (req, res) => {
  try {
    const videoId = req.query.videoId;
    if (!videoId || typeof videoId !== 'string') {
      return res.status(400).json({ error: 'videoId query parameter is required.' });
    }

    const url = await getYouTubeAudioUrl(videoId);
    if (!url) {
      return res.status(404).json({ error: 'Audio stream URL not found.' });
    }

    return res.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error.';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/search/songs', searchLimiter, async (req, res) => {
  console.log('[API] Incoming search request:', req.body);
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      console.warn('[API] Missing YOUTUBE_API_KEY');
    }
    const { query, limit = 12 } = req.body ?? {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required.' });
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      return res.json({ source: 'none', results: [] });
    }

    const safeLimit = Math.max(1, Math.min(Number(limit) || 12, 24));
    let results = await fetchItunesSearchResults(normalizedQuery, safeLimit);
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

    let geniusPromptContext = null;
    let googlePromptContext = null;
    const promptMatch = songs.find((song) => normalizeText(prompt).includes(normalizeText(song.title)));
    if (promptMatch) {
      try {
        geniusPromptContext = await fetchGeniusMetadata(promptMatch.title, promptMatch.artist);
      } catch {
        geniusPromptContext = null;
      }
    }

    if (googleMetadataEnabled) {
      try {
        const googleResults = await fetchGoogleSearchResults(prompt);
        googlePromptContext = googleResults.slice(0, 5).map((item) => ({
          title: stripHtmlTags(item?.title ?? ''),
          link: typeof item?.link === 'string' ? item.link : '',
          snippet: stripHtmlTags(item?.snippet ?? ''),
        }));
      } catch {
        googlePromptContext = null;
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
              geniusPromptContext,
              googlePromptContext,
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

    let geniusDetails = null;
    if (result.details?.songId) {
      const detailSong = songs.find((song) => song.id === result.details.songId);
      if (detailSong) {
        try {
          geniusDetails = await fetchGeniusMetadata(detailSong.title, detailSong.artist);
        } catch {
          geniusDetails = null;
        }
      }
    }

    return res.json({
      ...result,
      geniusDetails,
      model: openRouterModel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error.';
    return res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`[resend-api] Listening on http://localhost:${port}`);
  console.log('[resend-api] Config summary:', {
    appUrl,
    resendFromEmail,
    hasResendApiKey: Boolean(resendApiKey),
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasSupabaseServiceRoleKey: Boolean(supabaseServiceRoleKey),
    hasOpenRouterApiKey: Boolean(openRouterApiKey),
    hasGeniusAccessToken: Boolean(geniusAccessToken),
    hasGoogleCustomSearch: googleMetadataEnabled,
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
    genius: { windowMs: geniusRateLimitWindowMs, maxRequests: geniusRateLimitMax },
    metadata: { windowMs: metadataRateLimitWindowMs, maxRequests: metadataRateLimitMax },
    search: { windowMs: searchRateLimitWindowMs, maxRequests: searchRateLimitMax },
  });
});

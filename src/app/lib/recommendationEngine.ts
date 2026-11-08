import type { Song } from '../data/mockData';
import type { OnboardingPreferences } from '../components/OnboardingModal';
import { searchSongsOnline } from './songSearchApi';

interface LanguageHint {
  country: string;
  artists: string[];
  keywords: string[];
}

const LANGUAGE_HINTS: Record<string, LanguageHint> = {
  Hindi: {
    country: 'in',
    artists: ['Arijit Singh', 'Atif Aslam', 'Shreya Ghoshal', 'Pritam', 'Neha Kakkar', 'A. R. Rahman', 'Jubin Nautiyal', 'Anuv Jain', 'KK', 'Mohit Chauhan'],
    keywords: ['Bollywood', 'Hindi'],
  },
  Punjabi: {
    country: 'in',
    artists: ['Diljit Dosanjh', 'AP Dhillon', 'Karan Aujla', 'Sidhu Moose Wala', 'Shubh', 'Hardy Sandhu', 'Guru Randhawa', 'Jasmine Sandlas'],
    keywords: ['Punjabi'],
  },
  Tamil: {
    country: 'in',
    artists: ['A. R. Rahman', 'Anirudh Ravichander', 'Yuvan Shankar Raja', 'Sid Sriram', 'Harris Jayaraj', 'G. V. Prakash Kumar'],
    keywords: ['Tamil', 'Kollywood'],
  },
  Telugu: {
    country: 'in',
    artists: ['Devi Sri Prasad', 'S. S. Thaman', 'M. M. Keeravani', 'Anirudh Ravichander', 'Sid Sriram'],
    keywords: ['Telugu', 'Tollywood'],
  },
  Korean: {
    country: 'kr',
    artists: ['BTS', 'BLACKPINK', 'TWICE', 'IVE', 'NewJeans', 'SEVENTEEN', 'Stray Kids', 'aespa', 'LE SSERAFIM'],
    keywords: ['K-Pop'],
  },
  Spanish: {
    country: 'mx',
    artists: ['Bad Bunny', 'Karol G', 'Shakira', 'Rosalía', 'Peso Pluma', 'Feid', 'Rauw Alejandro', 'Maluma'],
    keywords: ['Latin', 'Reggaeton'],
  },
  Japanese: {
    country: 'jp',
    artists: ['YOASOBI', 'Ado', 'Aimer', 'Kenshi Yonezu', 'Vaundy', 'Official HIGE DANdism', 'Mrs. GREEN APPLE'],
    keywords: ['J-Pop'],
  },
  French: {
    country: 'fr',
    artists: ['Stromae', 'Aya Nakamura', 'Indila', 'Angèle', 'Gims', 'Vianney'],
    keywords: ['French Pop'],
  },
  English: {
    country: 'us',
    artists: ['Taylor Swift', 'The Weeknd', 'Drake', 'Billie Eilish', 'Ed Sheeran', 'Olivia Rodrigo', 'Dua Lipa', 'Post Malone'],
    keywords: ['Pop', 'Hip-Hop'],
  },
};

const LANGUAGE_GENRE_HINTS: Record<string, string[]> = {
  Hindi: ['Bollywood', 'Indian Pop', 'Hindi'],
  Punjabi: ['Punjabi', 'Bollywood', 'Indian Pop', 'Bhangra'],
  Tamil: ['Tamil', 'Kollywood'],
  Telugu: ['Telugu', 'Tollywood'],
  Korean: ['K-Pop'],
  Spanish: ['Latin', 'Reggaeton', 'Latin Pop'],
  Japanese: ['J-Pop'],
  French: ['French Pop', 'Chanson'],
  English: ['Pop', 'Hip-Hop', 'Rock', 'R&B'],
};

const GENRE_FAMILY: Record<string, string[]> = {
  Pop: ['pop', 'dance pop', 'electropop', 'teen pop', 'indie pop', 'synth-pop', 'synthpop', 'adult contemporary', 'singer/songwriter'],
  Rock: ['rock', 'alternative', 'indie rock', 'classic rock', 'pop rock', 'hard rock', 'punk', 'metal'],
  'Hip-Hop': ['hip-hop/rap', 'hip hop', 'rap', 'trap', 'drill', 'grime'],
  EDM: ['dance', 'electronic', 'house', 'edm', 'techno', 'dubstep', 'trance', 'big room'],
  Latin: ['latin', 'reggaeton', 'latin pop', 'latin urban', 'regional mexican'],
  'K-Pop': ['k-pop', 'korean pop', 'kpop'],
  Bollywood: ['bollywood', 'indian pop', 'desi', 'hindi', 'punjabi', 'soundtrack', 'worldwide', 'world', 'indian'],
  'R&B': ['r&b/soul', 'r&b', 'soul', 'neo soul', 'contemporary r&b'],
  Indie: ['indie', 'indie rock', 'indie pop', 'folk', 'alternative'],
  Jazz: ['jazz', 'smooth jazz', 'swing'],
  'Lo-fi': ['lo-fi', 'chillhop', 'lofi', 'ambient'],
  Classical: ['classical', 'orchestral', 'piano'],
  Punjabi: ['punjabi', 'bhangra'],
  Tamil: ['tamil', 'kollywood'],
  Telugu: ['telugu', 'tollywood'],
  'J-Pop': ['j-pop', 'japanese pop', 'anime'],
  'French Pop': ['french pop', 'chanson'],
};

const GENRE_LABELS: Record<string, string> = {
  'k-pop': 'K-Pop',
  'j-pop': 'J-Pop',
  'r&b/soul': 'R&B/Soul',
  'r&b': 'R&B',
  'lo-fi': 'Lo-Fi',
  edm: 'EDM',
  'hip-hop/rap': 'Hip-Hop/Rap',
  'hip hop': 'Hip-Hop',
  'synth-pop': 'Synth-Pop',
};

const GENRE_MOODS: Record<string, string[]> = {
  pop: ['Happy', 'Party', 'Energetic'],
  'dance pop': ['Happy', 'Party', 'Energetic'],
  electropop: ['Party', 'Energetic'],
  'teen pop': ['Happy', 'Party'],
  'indie pop': ['Chill', 'Happy'],
  'synth-pop': ['Party', 'Energetic'],
  'adult contemporary': ['Chill', 'Romantic'],
  'singer/songwriter': ['Sad', 'Chill', 'Romantic'],
  rock: ['Energetic', 'Workout'],
  alternative: ['Energetic', 'Sad'],
  'indie rock': ['Energetic', 'Sad'],
  'classic rock': ['Energetic'],
  'pop rock': ['Energetic', 'Happy'],
  metal: ['Workout', 'Energetic'],
  'hip-hop/rap': ['Energetic', 'Party', 'Workout'],
  'hip hop': ['Energetic', 'Party', 'Workout'],
  rap: ['Energetic', 'Party', 'Workout'],
  trap: ['Energetic', 'Party'],
  drill: ['Energetic', 'Workout'],
  dance: ['Party', 'Energetic', 'Workout'],
  electronic: ['Party', 'Energetic'],
  house: ['Party', 'Energetic', 'Workout'],
  edm: ['Party', 'Energetic', 'Workout'],
  techno: ['Workout', 'Energetic'],
  latin: ['Party', 'Happy', 'Energetic'],
  reggaeton: ['Party', 'Energetic'],
  'latin pop': ['Party', 'Happy'],
  'k-pop': ['Happy', 'Energetic', 'Party'],
  'korean pop': ['Happy', 'Energetic', 'Party'],
  bollywood: ['Romantic', 'Happy', 'Party'],
  'indian pop': ['Romantic', 'Happy', 'Party'],
  punjabi: ['Party', 'Energetic', 'Happy'],
  bhangra: ['Party', 'Energetic', 'Happy'],
  soundtrack: ['Romantic', 'Sad', 'Happy'],
  worldwide: ['Happy', 'Romantic', 'Party'],
  'r&b/soul': ['Romantic', 'Chill'],
  'r&b': ['Romantic', 'Chill'],
  soul: ['Romantic', 'Chill'],
  'neo soul': ['Chill', 'Romantic'],
  indie: ['Chill', 'Sad', 'Happy'],
  folk: ['Chill', 'Sad'],
  jazz: ['Chill', 'Focus', 'Romantic'],
  'smooth jazz': ['Chill', 'Focus'],
  'lo-fi': ['Chill', 'Focus', 'Sleep'],
  chillhop: ['Chill', 'Focus', 'Sleep'],
  ambient: ['Sleep', 'Focus', 'Chill'],
  classical: ['Focus', 'Sleep', 'Chill'],
  orchestral: ['Focus', 'Sleep'],
  piano: ['Focus', 'Sleep', 'Chill'],
};

const HIGH_ENERGY_GENRES = new Set([
  'dance', 'electronic', 'house', 'edm', 'techno', 'dubstep', 'trance',
  'hip-hop/rap', 'hip hop', 'rap', 'trap', 'drill', 'rock', 'metal', 'punk',
  'latin', 'reggaeton', 'k-pop', 'korean pop', 'punjabi', 'bhangra',
]);

const LOW_ENERGY_GENRES = new Set([
  'lo-fi', 'chillhop', 'lofi', 'ambient', 'jazz', 'smooth jazz',
  'classical', 'orchestral', 'piano', 'r&b/soul', 'r&b', 'soul', 'neo soul',
  'singer/songwriter', 'folk',
]);

const MOOD_QUERY_KEYWORDS: Record<string, string[]> = {
  Happy: ['happy', 'upbeat'],
  Chill: ['chill', 'relaxing'],
  Romantic: ['romantic', 'love'],
  Energetic: ['energetic', 'upbeat'],
  Focus: ['focus', 'study'],
  Workout: ['workout', 'gym'],
  Party: ['party', 'dance'],
  Sad: ['sad', 'heartbreak'],
  Sleep: ['sleep', 'lullaby', 'calm'],
};

const MOOD_TITLE_KEYWORDS: Record<string, string[]> = {
  Romantic: ['love', 'ishq', 'dil', 'pyar', 'pyaar', 'mohabbat', 'romance', 'sanam', 'janam', 'tere', 'tujhe'],
  Sad: ['sad', 'alone', 'breakup', 'yaad', 'judai', 'dard', 'tanha', 'broken', 'miss you'],
  Party: ['party', 'dance', 'nach', 'bhangra', 'club', 'celebration', 'dhamaka'],
  Chill: ['chill', 'relax', 'calm', 'sunset', 'lofi', 'slow'],
  Happy: ['happy', 'khushi', 'sunshine', 'smile', 'good vibes'],
  Workout: ['workout', 'gym', 'power', 'beast', 'run'],
  Sleep: ['sleep', 'lullaby', 'dream', 'raat', 'night'],
  Focus: ['focus', 'study', 'concentration'],
  Energetic: ['energy', 'fire', 'hype', 'bass', 'pump'],
};

const COUNTRY_ALIASES: Record<string, string> = {
  IND: 'IN',
  USA: 'US',
  GBR: 'GB',
  UK: 'GB',
  KOR: 'KR',
  JPN: 'JP',
  MEX: 'MX',
  FRA: 'FR',
  CAN: 'CA',
  AUS: 'AU',
  PAK: 'PK',
  DEU: 'DE',
  ESP: 'ES',
  BRA: 'BR',
};

const HARD_LOW_QUALITY_PATTERN = /\b(karaoke|instrumental|8d|nightcore|reaction|tutorial|lesson|behind the scenes|acapella|a cappella|mashup)\b/i;
const SOFT_LOW_QUALITY_PATTERN = /\b(cover|remix|slowed|reverb|sped up)\b/i;

const ARTIST_SEPARATOR = /\s*(?:,|&|\+|\band\b|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bx\b)\s*/i;
const ARTIST_NOISE = new Set(['feat', 'ft', 'with', 'and', 'the']);

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function splitArtists(artist: string | undefined): string[] {
  if (!artist) return [];
  const cleaned = artist.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  const parts = cleaned
    .split(ARTIST_SEPARATOR)
    .map((part) => normalizeText(part))
    .filter((part) => part.length > 1 && !ARTIST_NOISE.has(part));
  return Array.from(new Set(parts));
}

function primaryArtist(artist: string | undefined): string {
  return splitArtists(artist)[0] ?? normalizeText(artist);
}

function normalizeGenre(genre: string | undefined): string {
  return normalizeText(genre);
}

function familyKeysForGenre(genre: string | undefined): string[] {
  const lower = normalizeGenre(genre);
  if (!lower) return [];
  const keys = new Set<string>([lower]);
  const directFamily = GENRE_FAMILY[lower];
  if (directFamily) directFamily.forEach((alias) => keys.add(alias));
  Object.entries(GENRE_FAMILY).forEach(([family, aliases]) => {
    if (!aliases.includes(lower)) return;
    keys.add(normalizeText(family));
    aliases.forEach((alias) => keys.add(alias));
  });
  return Array.from(keys);
}

function genreLabel(value: string): string {
  const lower = normalizeGenre(value);
  if (GENRE_LABELS[lower]) return GENRE_LABELS[lower];
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeCountry(country: string | undefined): string {
  const value = (country ?? '').trim().toUpperCase();
  if (!value) return '';
  if (COUNTRY_ALIASES[value]) return COUNTRY_ALIASES[value];
  if (value.length === 2) return value;
  if (value.length === 3) return value.slice(0, 2);
  return value;
}

function normalizeTitleKey(title: string | undefined): string {
  return normalizeText(title)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s*[-–—]\s*[^-–—]*\b(version|remix|live|from|feat|with|edit|mix|acoustic|unplugged|cover)\b.*$/i, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stableUnitHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

function isPlayableVideoId(videoId: string | undefined): boolean {
  return typeof videoId === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

function moodsForGenre(genre: string | undefined): string[] {
  const moods = new Set<string>();
  familyKeysForGenre(genre).forEach((key) => {
    (GENRE_MOODS[key] ?? []).forEach((mood) => moods.add(mood));
  });
  return Array.from(moods);
}

function moodsForTitle(title: string | undefined): string[] {
  const value = normalizeText(title);
  if (!value) return [];
  return Object.entries(MOOD_TITLE_KEYWORDS)
    .filter(([, words]) => words.some((word) => value.includes(word)))
    .map(([mood]) => mood);
}

function energyForGenre(genre: string | undefined): 'low' | 'medium' | 'high' | null {
  const keys = familyKeysForGenre(genre);
  if (keys.length === 0) return null;
  if (keys.some((key) => HIGH_ENERGY_GENRES.has(key))) return 'high';
  if (keys.some((key) => LOW_ENERGY_GENRES.has(key))) return 'low';
  return 'medium';
}

export interface UserProfile {
  preferredLanguages: string[];
  preferredGenres: string[];
  preferredMoods: string[];
  preferredEnergy: 'low' | 'medium' | 'high';
  artistAffinity: Map<string, number>;
  genreAffinity: Map<string, number>;
  countryAffinity: Map<string, number>;
  preferredEra: { mean: number; spread: number } | null;
  excludeSongIds: Set<string>;
  topArtistLabel: string;
  topGenreLabel: string;
}

interface BuildProfileInput {
  prefs: OnboardingPreferences | null;
  likedSongs: Song[];
  recentSongs: Song[];
  currentSong: Song | null;
}

export function buildUserProfile({ prefs, likedSongs, recentSongs, currentSong }: BuildProfileInput): UserProfile {
  const artistAffinity = new Map<string, number>();
  const artistLabels = new Map<string, string>();
  const genreAffinity = new Map<string, number>();
  const genreLabels = new Map<string, string>();
  const countryAffinity = new Map<string, number>();
  const releaseYears: number[] = [];
  const excludeSongIds = new Set<string>();

  const bumpArtist = (artist: string | undefined, weight: number) => {
    splitArtists(artist).forEach((key) => {
      artistAffinity.set(key, (artistAffinity.get(key) ?? 0) + weight);
      if (!artistLabels.has(key)) {
        artistLabels.set(key, key.replace(/\b[a-z]/g, (char) => char.toUpperCase()));
      }
    });
  };

  const bumpGenre = (genre: string | undefined, weight: number) => {
    const key = normalizeGenre(genre);
    if (!key) return;
    genreAffinity.set(key, (genreAffinity.get(key) ?? 0) + weight);
    if (!genreLabels.has(key)) genreLabels.set(key, genreLabel(genre ?? key));
  };

  const bumpCountry = (country: string | undefined, weight: number) => {
    const key = normalizeCountry(country);
    if (!key) return;
    countryAffinity.set(key, (countryAffinity.get(key) ?? 0) + weight);
  };

  if (prefs) {
    prefs.languages.forEach((lang) => {
      const hint = LANGUAGE_HINTS[lang];
      if (hint) bumpCountry(hint.country, 1.5);
      (LANGUAGE_GENRE_HINTS[lang] ?? []).forEach((genre) => bumpGenre(genre, 1));
    });
    prefs.genres.forEach((genre) => {
      bumpGenre(genre, 2.4);
      (GENRE_FAMILY[genre] ?? []).forEach((alias) => bumpGenre(alias, 0.7));
    });
  }

  likedSongs.forEach((song) => {
    bumpArtist(song.artist, 4);
    bumpGenre(song.genre, 3);
    bumpCountry(song.country, 1.5);
    if (typeof song.releaseYear === 'number') releaseYears.push(song.releaseYear);
    excludeSongIds.add(song.id);
  });

  recentSongs.forEach((song) => {
    bumpArtist(song.artist, 2);
    bumpGenre(song.genre, 1.2);
    bumpCountry(song.country, 0.75);
    if (typeof song.releaseYear === 'number') releaseYears.push(song.releaseYear);
    excludeSongIds.add(song.id);
  });

  if (currentSong) {
    bumpArtist(currentSong.artist, 3);
    bumpGenre(currentSong.genre, 2);
    bumpCountry(currentSong.country, 1);
    if (typeof currentSong.releaseYear === 'number') releaseYears.push(currentSong.releaseYear);
    excludeSongIds.add(currentSong.id);
  }

  let preferredEra: UserProfile['preferredEra'] = null;
  if (releaseYears.length > 0) {
    const mean = releaseYears.reduce((sum, year) => sum + year, 0) / releaseYears.length;
    const variance =
      releaseYears.reduce((sum, year) => sum + Math.pow(year - mean, 2), 0) / releaseYears.length;
    const spread = Math.max(4, Math.sqrt(variance));
    preferredEra = { mean, spread };
  }

  const topArtistKey = topEntries(artistAffinity, 1)[0];
  const topGenreKey = topEntries(genreAffinity, 1)[0];

  return {
    preferredLanguages: prefs?.languages ?? [],
    preferredGenres: prefs?.genres ?? [],
    preferredMoods: prefs?.moods ?? [],
    preferredEnergy: prefs?.energy ?? 'medium',
    artistAffinity,
    genreAffinity,
    countryAffinity,
    preferredEra,
    excludeSongIds,
    topArtistLabel: topArtistKey ? (artistLabels.get(topArtistKey) ?? topArtistKey) : '',
    topGenreLabel: topGenreKey
      ? (genreLabels.get(topGenreKey) ?? genreLabel(topGenreKey))
      : (prefs?.genres[0] ?? ''),
  };
}

interface SeedQuery {
  query: string;
  country: string;
  weight: number;
}

function topEntries<T>(map: Map<T, number>, count: number): T[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([key]) => key as T);
}

export function buildSeedQueries(profile: UserProfile): SeedQuery[] {
  const queries: SeedQuery[] = [];
  const seen = new Set<string>();
  const push = (query: string, country: string, weight: number) => {
    const normalized = query.trim();
    if (!normalized) return;
    const key = `${country.toLowerCase()}|${normalized.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    queries.push({ query: normalized, country, weight });
  };

  const topCountry = topEntries(profile.countryAffinity, 1)[0]?.toLowerCase() ?? '';

  // 1. Artists you actually listened to or liked (strongest signal).
  topEntries(profile.artistAffinity, 4).forEach((artist, index) => {
    push(artist, topCountry, 1 - index * 0.08);
  });

  // 2. Genre lanes so the row doesn't become a single-artist echo chamber.
  const topGenres = topEntries(profile.genreAffinity, 3);
  topGenres.forEach((genre, index) => {
    push(`${genre} hits`, topCountry, 0.86 - index * 0.1);
  });

  // 3. Preferred language artists + genre keywords.
  profile.preferredLanguages.forEach((lang, index) => {
    const hint = LANGUAGE_HINTS[lang];
    if (!hint) {
      push(`top ${lang.toLowerCase()} songs`, '', 0.5);
      return;
    }
    const artistCount = index === 0 ? 3 : 2;
    hint.artists.slice(0, artistCount).forEach((artist) => push(artist, hint.country, 0.72));
    hint.keywords.slice(0, 1).forEach((keyword) => {
      push(`top ${keyword.toLowerCase()} songs`, hint.country, 0.58);
    });
  });

  // 4. Mood/energy lanes, blended with the user's top genre or language.
  const languageLabel = profile.preferredLanguages[0]?.toLowerCase() ?? '';
  const genreLabelValue = topGenres[0] ?? '';
  profile.preferredMoods.slice(0, 2).forEach((mood, index) => {
    const keyword = MOOD_QUERY_KEYWORDS[mood]?.[0];
    if (!keyword) return;
    const lane = genreLabelValue || languageLabel;
    push([keyword, lane, 'songs'].filter(Boolean).join(' '), topCountry, 0.56 - index * 0.05);
  });

  if (queries.length < 8) {
    push('top trending songs', 'us', 0.3);
  }

  return queries.sort((a, b) => b.weight - a.weight).slice(0, 12);
}

function genreScore(songGenre: string | undefined, profile: UserProfile): number {
  const keys = familyKeysForGenre(songGenre);
  if (keys.length === 0) return 0;
  let best = 0;
  keys.forEach((key) => {
    best = Math.max(best, profile.genreAffinity.get(key) ?? 0);
  });
  return best;
}

function artistAffinityScore(songArtist: string | undefined, profile: UserProfile): number {
  const keys = splitArtists(songArtist);
  let best = 0;
  keys.forEach((key) => {
    const direct = profile.artistAffinity.get(key) ?? 0;
    if (direct > best) best = direct;
    profile.artistAffinity.forEach((weight, profileKey) => {
      if (key === profileKey) return;
      if (key.includes(profileKey) || profileKey.includes(key)) {
        best = Math.max(best, weight * 0.8);
      }
    });
  });
  return best;
}

function moodScore(song: Song, profile: UserProfile): number {
  if (profile.preferredMoods.length === 0) return 0;
  const genreMoods = moodsForGenre(song.genre);
  const titleMoods = moodsForTitle(song.title);
  let score = 0;
  profile.preferredMoods.forEach((mood) => {
    if (genreMoods.includes(mood) || titleMoods.includes(mood)) score += 9;
  });
  return Math.min(score, 18);
}

function energyScore(song: Song, profile: UserProfile): number {
  const energy = energyForGenre(song.genre);
  if (!energy) return 0;
  if (energy === profile.preferredEnergy) return 8;
  const order = { low: 0, medium: 1, high: 2 } as const;
  return Math.abs(order[energy] - order[profile.preferredEnergy]) === 1 ? 3 : 0;
}

export function scoreSong(song: Song, profile: UserProfile): number {
  if (profile.excludeSongIds.has(song.id)) return -1;
  if (!song.title?.trim() || !song.artist?.trim()) return -1;

  let score = 0;

  // Artist affinity is the strongest signal (YouTube/Spotify "more from this artist").
  score += 30 * artistAffinityScore(song.artist, profile);

  // Genre affinity in the second lane.
  score += 20 * genreScore(song.genre, profile);

  // Region / language affinity.
  const countryKey = normalizeCountry(song.country);
  if (countryKey) {
    score += 10 * (profile.countryAffinity.get(countryKey) ?? 0);
  }

  // Era closeness.
  if (typeof song.releaseYear === 'number' && profile.preferredEra) {
    const distance = Math.abs(song.releaseYear - profile.preferredEra.mean);
    score += Math.max(0, 6 - distance / Math.max(profile.preferredEra.spread, 4));
  }

  // Mood and energy fit.
  score += moodScore(song, profile);
  score += energyScore(song, profile);

  // Stable tie-breaker: deterministic, so the row never reshuffles between refreshes.
  score += stableUnitHash(song.id) * 1.2;

  // Prefer results that are immediately playable (YT Music results already have IDs).
  if (isPlayableVideoId(song.videoId)) score += 3;

  // Drop karaoke / cover / remix noise to the bottom of the list.
  if (HARD_LOW_QUALITY_PATTERN.test(song.title)) score -= 80;
  else if (SOFT_LOW_QUALITY_PATTERN.test(song.title)) score -= 25;

  return score;
}

export function rankAndDiversify(candidates: Song[], profile: UserProfile, limit = 12): Song[] {
  const scored = candidates
    .map((song) => ({ song, score: scoreSong(song, profile) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.song.title.localeCompare(b.song.title);
    });

  const result: Song[] = [];
  const perArtist = new Map<string, number>();
  const perAlbum = new Map<string, number>();
  const perGenre = new Map<string, number>();
  const seenTitleKeys = new Set<string>();

  const maxPerArtist = 2;
  const maxPerAlbum = 2;
  const maxPerGenre = Math.max(4, Math.ceil(limit * 0.45));

  const albumKey = (song: Song) => normalizeText(song.album);
  const genreKey = (song: Song) => normalizeGenre(song.genre) || '__unknown__';

  const tryAdd = (song: Song, enforceAlbumAndGenre: boolean): boolean => {
    if (result.length >= limit) return false;
    const artistKey = primaryArtist(song.artist) || '__unknown__';
    const titleKey = `${normalizeTitleKey(song.title)}|${artistKey}`;
    if (seenTitleKeys.has(titleKey)) return false;
    if ((perArtist.get(artistKey) ?? 0) >= maxPerArtist) return false;
    if (enforceAlbumAndGenre) {
      const album = albumKey(song);
      if (album && (perAlbum.get(album) ?? 0) >= maxPerAlbum) return false;
      const genre = genreKey(song);
      if (genre !== '__unknown__' && (perGenre.get(genre) ?? 0) >= maxPerGenre) return false;
    }
    perArtist.set(artistKey, (perArtist.get(artistKey) ?? 0) + 1);
    const album = albumKey(song);
    if (album) perAlbum.set(album, (perAlbum.get(album) ?? 0) + 1);
    perGenre.set(genreKey(song), (perGenre.get(genreKey(song)) ?? 0) + 1);
    seenTitleKeys.add(titleKey);
    result.push(song);
    return true;
  };

  // First pass respects artist/album/genre caps so the row mixes lanes.
  for (const { song } of scored) {
    tryAdd(song, true);
    if (result.length >= limit) return result;
  }

  // Second pass relaxes album/genre caps but still avoids the same artist.
  for (const { song } of scored) {
    tryAdd(song, false);
    if (result.length >= limit) return result;
  }

  // Final fill: guarantee a full row if the pool is small.
  for (const { song } of scored) {
    if (result.some((existing) => existing.id === song.id)) continue;
    result.push(song);
    if (result.length >= limit) break;
  }

  return result;
}

interface FetchOptions {
  perQueryLimit?: number;
  signal?: AbortSignal;
}

export async function fetchCandidates(seeds: SeedQuery[], options: FetchOptions = {}): Promise<Song[]> {
  const perQuery = options.perQueryLimit ?? 4;
  const trimmedSeeds = seeds.slice(0, 8);
  const results = await Promise.all(
    trimmedSeeds.map(({ query, country }) =>
      searchSongsOnline(query, perQuery, country, { enrichVideoIds: false }),
    ),
  );

  const merged: Song[] = [];
  const seen = new Set<string>();
  results.forEach((result) => {
    (result.data ?? []).forEach((song) => {
      const key = song.videoId || song.id;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(song);
    });
  });
  return merged;
}

export async function generateRecommendations(
  input: BuildProfileInput,
  limit = 12,
): Promise<{ songs: Song[]; profile: UserProfile }> {
  const profile = buildUserProfile(input);
  const seeds = buildSeedQueries(profile);
  if (seeds.length === 0) return { songs: [], profile };
  const candidates = await fetchCandidates(seeds);
  const ranked = rankAndDiversify(candidates, profile, limit);
  return { songs: ranked, profile };
}

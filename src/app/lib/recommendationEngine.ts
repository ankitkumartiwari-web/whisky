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

const GENRE_FAMILY: Record<string, string[]> = {
  Pop: ['pop', 'dance pop', 'electropop', 'indie pop'],
  Rock: ['rock', 'alternative', 'indie rock', 'classic rock', 'pop rock'],
  'Hip-Hop': ['hip-hop/rap', 'hip hop', 'rap', 'r&b/soul', 'r&b'],
  EDM: ['dance', 'electronic', 'house', 'edm'],
  Latin: ['latin', 'reggaeton', 'latin pop', 'latin urban'],
  'K-Pop': ['k-pop', 'korean pop'],
  Bollywood: ['bollywood', 'indian pop', 'desi'],
  'R&B': ['r&b/soul', 'r&b', 'soul'],
  Indie: ['indie', 'alternative', 'indie rock', 'indie pop'],
  Jazz: ['jazz', 'smooth jazz'],
  'Lo-fi': ['lo-fi', 'chillhop'],
  Classical: ['classical', 'orchestral', 'piano'],
};

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
}

interface BuildProfileInput {
  prefs: OnboardingPreferences | null;
  likedSongs: Song[];
  recentSongs: Song[];
  currentSong: Song | null;
}

export function buildUserProfile({ prefs, likedSongs, recentSongs, currentSong }: BuildProfileInput): UserProfile {
  const artistAffinity = new Map<string, number>();
  const genreAffinity = new Map<string, number>();
  const countryAffinity = new Map<string, number>();
  const releaseYears: number[] = [];
  const excludeSongIds = new Set<string>();

  const bumpArtist = (artist: string | undefined, weight: number) => {
    if (!artist) return;
    const key = artist.trim().toLowerCase();
    if (!key) return;
    artistAffinity.set(key, (artistAffinity.get(key) ?? 0) + weight);
  };

  const bumpGenre = (genre: string | undefined, weight: number) => {
    if (!genre) return;
    const key = genre.trim().toLowerCase();
    if (!key) return;
    genreAffinity.set(key, (genreAffinity.get(key) ?? 0) + weight);
  };

  const bumpCountry = (country: string | undefined, weight: number) => {
    if (!country) return;
    const key = country.trim().toUpperCase();
    if (!key) return;
    countryAffinity.set(key, (countryAffinity.get(key) ?? 0) + weight);
  };

  likedSongs.forEach((song) => {
    bumpArtist(song.artist, 4);
    bumpGenre(song.genre, 3);
    bumpCountry(song.country, 1.5);
    if (typeof song.releaseYear === 'number') releaseYears.push(song.releaseYear);
    excludeSongIds.add(song.id);
  });

  recentSongs.forEach((song) => {
    bumpArtist(song.artist, 2);
    bumpGenre(song.genre, 1);
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

  if (prefs) {
    prefs.languages.forEach((lang) => {
      const hint = LANGUAGE_HINTS[lang];
      if (hint) bumpCountry(hint.country, 1);
    });
    prefs.genres.forEach((genre) => {
      bumpGenre(genre, 0.5);
      (GENRE_FAMILY[genre] ?? []).forEach((alias) => bumpGenre(alias, 0.5));
    });
  }

  let preferredEra: UserProfile['preferredEra'] = null;
  if (releaseYears.length > 0) {
    const mean = releaseYears.reduce((sum, y) => sum + y, 0) / releaseYears.length;
    const variance =
      releaseYears.reduce((sum, y) => sum + Math.pow(y - mean, 2), 0) / releaseYears.length;
    const spread = Math.max(4, Math.sqrt(variance));
    preferredEra = { mean, spread };
  }

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
    .map(([key]) => key);
}

export function buildSeedQueries(profile: UserProfile): SeedQuery[] {
  const queries: SeedQuery[] = [];
  const seen = new Set<string>();
  const push = (query: string, country: string, weight: number) => {
    const key = `${country}|${query.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    queries.push({ query, country, weight });
  };

  const topArtists = topEntries(profile.artistAffinity, 5);
  topArtists.forEach((artist, idx) => {
    push(artist, '', 1 - idx * 0.1);
  });

  profile.preferredLanguages.forEach((lang, idx) => {
    const hint = LANGUAGE_HINTS[lang];
    if (!hint) {
      push(`top ${lang} songs`, '', 0.5);
      return;
    }
    const artistCount = idx === 0 ? 4 : 2;
    hint.artists.slice(0, artistCount).forEach((artist) => push(artist, hint.country, 0.7));
  });

  if (queries.length < 6) {
    push('top trending songs', 'us', 0.3);
  }

  return queries.slice(0, 10);
}

function genreScore(songGenre: string | undefined, profile: UserProfile): number {
  if (!songGenre) return 0;
  const lower = songGenre.toLowerCase();
  const direct = profile.genreAffinity.get(lower) ?? 0;
  let familyScore = 0;
  profile.genreAffinity.forEach((weight, key) => {
    if (key === lower) return;
    if (lower.includes(key) || key.includes(lower)) {
      familyScore = Math.max(familyScore, weight * 0.6);
    }
  });
  return direct + familyScore;
}

export function scoreSong(song: Song, profile: UserProfile): number {
  if (profile.excludeSongIds.has(song.id)) return -1;
  if (!song.videoId || song.videoId.length !== 11) return -1;

  let score = 0;

  const artistKey = song.artist.trim().toLowerCase();
  const artistAff = profile.artistAffinity.get(artistKey);
  if (artistAff) score += 18 * artistAff;

  score += 12 * genreScore(song.genre, profile);

  const countryKey = (song.country ?? '').toUpperCase();
  if (countryKey) {
    const countryAff = profile.countryAffinity.get(countryKey);
    if (countryAff) score += 8 * countryAff;
  }

  if (typeof song.releaseYear === 'number' && profile.preferredEra) {
    const distance = Math.abs(song.releaseYear - profile.preferredEra.mean);
    const eraScore = Math.max(0, 6 - distance / Math.max(profile.preferredEra.spread, 4));
    score += eraScore;
  }

  if (artistAff && profile.genreAffinity.size > 0) score += 4;

  score += Math.random() * 0.5;

  return score;
}

export function rankAndDiversify(candidates: Song[], profile: UserProfile, limit = 12): Song[] {
  const scored = candidates
    .map((song) => ({ song, score: scoreSong(song, profile) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  const result: Song[] = [];
  const perArtist = new Map<string, number>();
  const maxPerArtist = 2;

  for (const { song } of scored) {
    const artistKey = song.artist.trim().toLowerCase();
    const used = perArtist.get(artistKey) ?? 0;
    if (used >= maxPerArtist) continue;
    perArtist.set(artistKey, used + 1);
    result.push(song);
    if (result.length >= limit) break;
  }

  if (result.length < limit) {
    for (const { song } of scored) {
      if (result.find((existing) => existing.id === song.id)) continue;
      result.push(song);
      if (result.length >= limit) break;
    }
  }

  return result;
}

interface FetchOptions {
  perQueryLimit?: number;
  signal?: AbortSignal;
}

export async function fetchCandidates(seeds: SeedQuery[], options: FetchOptions = {}): Promise<Song[]> {
  const perQuery = options.perQueryLimit ?? 3;
  const trimmedSeeds = seeds.slice(0, 6);
  const results = await Promise.all(
    trimmedSeeds.map(({ query, country }) => searchSongsOnline(query, perQuery, country)),
  );

  const merged: Song[] = [];
  const seen = new Set<string>();
  results.forEach((result) => {
    (result.data ?? []).forEach((song) => {
      const key = song.id;
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

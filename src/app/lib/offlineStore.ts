import type { Song } from '../data/mockData';

const DB_NAME = 'whisky-offline';
const DB_VERSION = 2;
const SONGS_STORE = 'saved-songs';
const COVERS_STORE = 'cached-covers';
const PLAY_EVENTS_STORE = 'play-events';

interface SavedSongRecord extends Song {
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SONGS_STORE)) {
        const store = db.createObjectStore(SONGS_STORE, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(COVERS_STORE)) {
        db.createObjectStore(COVERS_STORE);
      }
      if (!db.objectStoreNames.contains(PLAY_EVENTS_STORE)) {
        const store = db.createObjectStore(PLAY_EVENTS_STORE, {
          keyPath: 'eventId',
          autoIncrement: true,
        });
        store.createIndex('playedAt', 'playedAt', { unique: false });
        store.createIndex('songId', 'songId', { unique: false });
        store.createIndex('artist', 'artist', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open offline DB.'));
  });
  return dbPromise;
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Offline DB error.'));
      }),
  );
}

export async function saveSongOffline(song: Song): Promise<void> {
  const record: SavedSongRecord = { ...song, savedAt: Date.now() };
  await tx(SONGS_STORE, 'readwrite', (store) => store.put(record));
  if (song.coverUrl) {
    void cacheCover(song.coverUrl).catch(() => {});
  }
}

export async function removeSongOffline(songId: string): Promise<void> {
  await tx(SONGS_STORE, 'readwrite', (store) => store.delete(songId));
}

export async function listSavedSongs(): Promise<Song[]> {
  try {
    const all = await tx<SavedSongRecord[]>(SONGS_STORE, 'readonly', (store) => store.getAll());
    return [...all].sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function isSongSaved(songId: string): Promise<boolean> {
  try {
    const result = await tx(SONGS_STORE, 'readonly', (store) => store.get(songId));
    return Boolean(result);
  } catch {
    return false;
  }
}

async function cacheCover(url: string): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open('whisky-covers');
    const cached = await cache.match(url);
    if (cached) return;
    const response = await fetch(url, { mode: 'cors' });
    if (response.ok) await cache.put(url, response.clone());
  } catch {
    // best-effort; ignore failures
  }
}

export async function getSavedSongIds(): Promise<Set<string>> {
  const songs = await listSavedSongs();
  return new Set(songs.map((s) => s.id));
}

export interface PlayEventRecord {
  eventId?: number;
  songId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  videoId?: string;
  playedAt: number;
}

export async function logPlayEvent(song: Song): Promise<void> {
  if (!song?.id) return;
  const record: PlayEventRecord = {
    songId: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album ?? '',
    coverUrl: song.coverUrl ?? '',
    videoId: song.videoId,
    playedAt: Date.now(),
  };
  try {
    await tx(PLAY_EVENTS_STORE, 'readwrite', (store) => store.add(record));
    window.dispatchEvent(new CustomEvent('whisky:play-events-changed'));
  } catch {
    // ignore — IndexedDB may not be available or schema upgrade may have failed
  }
}

async function listPlayEventsBetween(fromMs: number, toMs: number): Promise<PlayEventRecord[]> {
  try {
    const all = await tx<PlayEventRecord[]>(PLAY_EVENTS_STORE, 'readonly', (store) => store.getAll());
    return all.filter((event) => event.playedAt >= fromMs && event.playedAt <= toMs);
  } catch {
    return [];
  }
}

export type StatsPeriod = 'month' | 'year' | 'all';

export function getPeriodRange(period: StatsPeriod, reference: Date = new Date()): { fromMs: number; toMs: number } {
  const toMs = reference.getTime();
  if (period === 'month') {
    const from = new Date(reference);
    from.setDate(from.getDate() - 30);
    return { fromMs: from.getTime(), toMs };
  }
  if (period === 'year') {
    const from = new Date(reference);
    from.setFullYear(from.getFullYear() - 1);
    return { fromMs: from.getTime(), toMs };
  }
  return { fromMs: 0, toMs };
}

export interface AggregatedEntry {
  key: string;
  count: number;
  song: PlayEventRecord;
}

export async function getTopArtists(period: StatsPeriod, limit = 8): Promise<AggregatedEntry[]> {
  const { fromMs, toMs } = getPeriodRange(period);
  const events = await listPlayEventsBetween(fromMs, toMs);
  const tally = new Map<string, AggregatedEntry>();
  events.forEach((event) => {
    const key = (event.artist || 'Unknown').trim();
    if (!key) return;
    const entry = tally.get(key);
    if (entry) entry.count += 1;
    else tally.set(key, { key, count: 1, song: event });
  });
  return Array.from(tally.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getTopSongs(period: StatsPeriod, limit = 12): Promise<AggregatedEntry[]> {
  const { fromMs, toMs } = getPeriodRange(period);
  const events = await listPlayEventsBetween(fromMs, toMs);
  const tally = new Map<string, AggregatedEntry>();
  events.forEach((event) => {
    const key = event.songId;
    if (!key) return;
    const entry = tally.get(key);
    if (entry) entry.count += 1;
    else tally.set(key, { key, count: 1, song: event });
  });
  return Array.from(tally.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getTotalPlayCount(period: StatsPeriod): Promise<number> {
  const { fromMs, toMs } = getPeriodRange(period);
  const events = await listPlayEventsBetween(fromMs, toMs);
  return events.length;
}

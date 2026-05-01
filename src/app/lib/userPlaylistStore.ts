import type { Song } from '../data/mockData';

export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  songIds: string[];
  songs: Record<string, Song>;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'whisky-user-playlists';
const CHANGE_EVENT = 'whisky:user-playlists-changed';

function loadAll(): UserPlaylist[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) =>
        p &&
        typeof p === 'object' &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        Array.isArray(p.songIds) &&
        p.songs &&
        typeof p.songs === 'object',
    ) as UserPlaylist[];
  } catch {
    return [];
  }
}

function saveAll(list: UserPlaylist[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function listUserPlaylists(): UserPlaylist[] {
  return loadAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getUserPlaylist(id: string): UserPlaylist | null {
  return loadAll().find((p) => p.id === id) ?? null;
}

export function createUserPlaylist(name: string, description = ''): UserPlaylist {
  const trimmed = name.trim() || 'New Playlist';
  const playlist: UserPlaylist = {
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    description,
    songIds: [],
    songs: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const list = loadAll();
  list.push(playlist);
  saveAll(list);
  return playlist;
}

export function deleteUserPlaylist(id: string): void {
  const list = loadAll().filter((p) => p.id !== id);
  saveAll(list);
}

export function renameUserPlaylist(id: string, name: string, description?: string): void {
  const list = loadAll();
  const target = list.find((p) => p.id === id);
  if (!target) return;
  target.name = name.trim() || target.name;
  if (typeof description === 'string') target.description = description;
  target.updatedAt = Date.now();
  saveAll(list);
}

export function addSongToPlaylist(playlistId: string, song: Song): void {
  const list = loadAll();
  const target = list.find((p) => p.id === playlistId);
  if (!target) return;
  if (target.songIds.includes(song.id)) return;
  target.songIds.push(song.id);
  target.songs[song.id] = { ...song };
  target.updatedAt = Date.now();
  saveAll(list);
}

export function removeSongFromPlaylist(playlistId: string, songId: string): void {
  const list = loadAll();
  const target = list.find((p) => p.id === playlistId);
  if (!target) return;
  target.songIds = target.songIds.filter((id) => id !== songId);
  delete target.songs[songId];
  target.updatedAt = Date.now();
  saveAll(list);
}

export function getPlaylistsContaining(songId: string): string[] {
  return loadAll()
    .filter((p) => p.songIds.includes(songId))
    .map((p) => p.id);
}

export const USER_PLAYLISTS_CHANGE_EVENT = CHANGE_EVENT;

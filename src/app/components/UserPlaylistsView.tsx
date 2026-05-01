import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ListMusic, Plus, Trash2, X } from 'lucide-react';
import type { Song } from '../data/mockData';
import {
  USER_PLAYLISTS_CHANGE_EVENT,
  createUserPlaylist,
  deleteUserPlaylist,
  listUserPlaylists,
  removeSongFromPlaylist,
  type UserPlaylist,
} from '../lib/userPlaylistStore';

interface UserPlaylistsViewProps {
  onPlaySong: (song: Song) => void;
  likedSongIds: Set<string>;
}

export function UserPlaylistsView({ onPlaySong }: UserPlaylistsViewProps) {
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const refresh = () => setPlaylists(listUserPlaylists());

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener(USER_PLAYLISTS_CHANGE_EVENT, handler);
    return () => window.removeEventListener(USER_PLAYLISTS_CHANGE_EVENT, handler);
  }, []);

  const active = useMemo(
    () => playlists.find((p) => p.id === activeId) ?? null,
    [playlists, activeId],
  );

  const handleCreate = (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const playlist = createUserPlaylist(name);
    setNewName('');
    setActiveId(playlist.id);
  };

  const handleDelete = (id: string) => {
    deleteUserPlaylist(id);
    if (activeId === id) setActiveId(null);
  };

  const handlePlayAll = (playlist: UserPlaylist) => {
    const first = playlist.songIds.map((id) => playlist.songs[id]).find(Boolean);
    if (first) onPlaySong(first);
  };

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your collection</p>
        <h2 className="text-4xl tracking-tight">Playlists</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Build your own mixes. Add songs from anywhere using the + icon on a song's detail page.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name a new playlist..."
          className="flex-1 min-w-[240px] rounded-full border border-border bg-secondary/40 px-5 py-3 text-sm focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> Create playlist
        </button>
      </form>

      {playlists.length === 0 ? (
        <div className="rounded-3xl border border-border bg-secondary/30 p-10 text-center text-sm text-muted-foreground">
          No playlists yet. Create your first one above.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {playlists.map((p) => {
            const previewSongs = p.songIds.slice(0, 4).map((id) => p.songs[id]).filter(Boolean);
            return (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => setActiveId(p.id)}
                whileHover={{ y: -4 }}
                className="group relative overflow-hidden rounded-3xl border border-border bg-card text-card-foreground p-4 text-left transition-shadow hover:shadow-2xl"
              >
                <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-2xl bg-secondary mb-4">
                  {previewSongs.length === 0 ? (
                    <div className="col-span-2 row-span-2 flex items-center justify-center text-muted-foreground">
                      <ListMusic className="h-10 w-10" />
                    </div>
                  ) : (
                    previewSongs.map((song, idx) => (
                      <img
                        key={song.id + idx}
                        src={song.coverUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ))
                  )}
                </div>
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.songIds.length} song{p.songIds.length === 1 ? '' : 's'}
                </p>
              </motion.button>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center px-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.78)' }}
            onClick={() => setActiveId(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl max-h-[80vh] rounded-3xl bg-background text-foreground border border-border shadow-2xl flex flex-col"
            >
              <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Playlist</p>
                  <h3 className="truncate text-2xl">{active.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {active.songIds.length} song{active.songIds.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {active.songIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handlePlayAll(active)}
                      className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:brightness-110"
                    >
                      Play all
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(active.id)}
                    className="rounded-full p-2 text-muted-foreground hover:text-destructive"
                    title="Delete playlist"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    className="rounded-full p-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </header>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {active.songIds.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-muted-foreground">
                    No songs yet. Open any track and tap the + icon to add it here.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {active.songIds.map((id, idx) => {
                      const song = active.songs[id];
                      if (!song) return null;
                      return (
                        <li key={id} className="flex items-center gap-3 px-6 py-3 hover:bg-secondary/40 group">
                          <span className="w-6 text-right text-xs text-muted-foreground">{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => onPlaySong(song)}
                            className="flex flex-1 items-center gap-3 text-left"
                          >
                            <img src={song.coverUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{song.title}</p>
                              <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSongFromPlaylist(active.id, song.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                            title="Remove from playlist"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

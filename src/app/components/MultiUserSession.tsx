import { motion, AnimatePresence } from 'motion/react';
import { Check, Copy, LogOut, Play, Radio, Users, Wifi, WifiOff } from 'lucide-react';
import type { CollabRoomApi, SessionUser } from '../lib/useCollabRoom';

interface MultiUserSessionProps {
  room: CollabRoomApi;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function colorFromId(id: string): string {
  const palette = [
    'from-pink-500 to-rose-500',
    'from-amber-400 to-orange-500',
    'from-emerald-400 to-teal-500',
    'from-sky-400 to-indigo-500',
    'from-fuchsia-500 to-purple-600',
    'from-lime-400 to-emerald-500',
    'from-cyan-400 to-blue-500',
    'from-violet-500 to-purple-500',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export function MultiUserSession({ room }: MultiUserSessionProps) {
  const {
    isConfigured,
    roomCode,
    currentUserId,
    currentSongId,
    currentSongTitle,
    currentSongArtist,
    isJoined,
    pendingCode,
    setPendingCode,
    users,
    hostUser,
    isSyncing,
    followAlong,
    remoteSong,
    copied,
    statusMessage,
    connectionStatus,
    createRoom,
    joinRoom,
    leaveRoom,
    copyRoomCode,
    setSyncing,
    setFollowAlong,
    playRemoteSong,
  } = room;

  if (!isConfigured) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/50 backdrop-blur-xl p-10 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <WifiOff className="h-7 w-7" />
        </div>
        <h3 className="text-xl mb-2">Realtime is not configured</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Add Supabase credentials (<code className="text-foreground">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-foreground">VITE_SUPABASE_ANON_KEY</code>) to your environment to enable
          collaborative listening rooms.
        </p>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-border/70 bg-card/50 backdrop-blur-xl p-10"
      >
        <div className="grid md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Radio className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Start a session</p>
                <h3 className="text-2xl">Host a listening room</h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Generate a private room code and share it with friends. Everyone in the room sees who's listening
              live.
            </p>
            <button
              type="button"
              onClick={createRoom}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:brightness-105"
            >
              <Radio className="h-4 w-4" /> Create new room
            </button>
          </div>

          <div className="space-y-6 md:border-l md:border-border/70 md:pl-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-foreground">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Got a code?</p>
                <h3 className="text-2xl">Join a friend's room</h3>
              </div>
            </div>
            <form onSubmit={joinRoom} className="space-y-3">
              <input
                value={pendingCode}
                onChange={(event) => setPendingCode(event.target.value.replace(/\s+/g, '').toUpperCase())}
                placeholder="Enter code (e.g. AB7K2P)"
                maxLength={8}
                className="w-full rounded-2xl border border-border/70 bg-secondary/40 px-5 py-3 text-base tracking-[0.3em] text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70"
              >
                Join room
              </button>
            </form>
            {statusMessage && <p className="text-xs text-amber-400">{statusMessage}</p>}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="rounded-3xl border border-border/70 bg-card/50 backdrop-blur-xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Room code</p>
            <div className="flex items-center gap-3">
              <span className="text-4xl tracking-[0.4em] font-semibold">{roomCode}</span>
              <button
                type="button"
                onClick={copyRoomCode}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary/70"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                connectionStatus === 'live'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : connectionStatus === 'connecting'
                    ? 'bg-amber-500/15 text-amber-400'
                    : connectionStatus === 'error'
                      ? 'bg-rose-500/15 text-rose-400'
                      : 'bg-secondary text-muted-foreground'
              }`}
            >
              {connectionStatus === 'error' ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
              {connectionStatus === 'live'
                ? 'Live'
                : connectionStatus === 'connecting'
                  ? 'Connecting...'
                  : connectionStatus === 'error'
                    ? 'Connection error'
                    : 'Idle'}
            </div>
            <button
              type="button"
              onClick={leaveRoom}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary/70"
            >
              <LogOut className="h-4 w-4" /> Leave
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-2xl border border-border/70 bg-background/40 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Now playing</p>
            {currentSongId ? (
              <div>
                <p className="text-lg">{currentSongTitle || 'Untitled track'}</p>
                <p className="text-sm text-muted-foreground">{currentSongArtist || 'Unknown artist'}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pick a song from the library — it will appear here for everyone in the room.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/40 p-5 cursor-pointer">
              <input
                type="checkbox"
                checked={isSyncing}
                onChange={(event) => setSyncing(event.target.checked)}
                className="mt-1 h-4 w-4 accent-accent"
              />
              <div>
                <p className="text-sm">Broadcast my track</p>
                <p className="text-xs text-muted-foreground mt-1">Others see what you play in real time.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/40 p-5 cursor-pointer">
              <input
                type="checkbox"
                checked={followAlong}
                onChange={(event) => setFollowAlong(event.target.checked)}
                className="mt-1 h-4 w-4 accent-accent"
              />
              <div>
                <p className="text-sm">Listen along</p>
                <p className="text-xs text-muted-foreground mt-1">Auto-play whatever the host broadcasts.</p>
              </div>
            </label>
          </div>
        </div>

        {remoteSong && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-center gap-4 rounded-2xl border border-accent/30 bg-accent/5 p-5"
          >
            {remoteSong.coverUrl && (
              <img src={remoteSong.coverUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-accent">
                {remoteSong.fromDisplayName || 'A listener'} is playing
              </p>
              <p className="text-sm truncate">{remoteSong.title}</p>
              <p className="text-xs text-muted-foreground truncate">{remoteSong.artist}</p>
            </div>
            <button
              type="button"
              onClick={() => playRemoteSong(remoteSong)}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent/90"
            >
              <Play className="h-3.5 w-3.5" /> Play this
            </button>
          </motion.div>
        )}
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/50 backdrop-blur-xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Listeners</p>
            <h3 className="text-2xl">
              {users.length} {users.length === 1 ? 'person' : 'people'} in the room
            </h3>
          </div>
          {hostUser && (
            <p className="text-xs text-muted-foreground">
              Hosted by <span className="text-foreground">{hostUser.displayName}</span>
            </p>
          )}
        </div>

        <AnimatePresence>
          {statusMessage && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-4 text-xs text-muted-foreground"
            >
              {statusMessage}
            </motion.p>
          )}
        </AnimatePresence>

        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You're the first one here. Share your room code to bring friends in.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {users.map((user: SessionUser) => {
                const isMe = user.id === currentUserId;
                const gradient = colorFromId(user.id);
                return (
                  <motion.li
                    key={user.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/40 px-4 py-3"
                  >
                    <div
                      className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-sm font-semibold text-white`}
                    >
                      {initialsFromName(user.displayName)}
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {user.displayName}
                        {isMe && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{user.isHost ? 'Host' : 'Listener'}</p>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </motion.div>
  );
}

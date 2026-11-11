import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from './supabaseClient';

export interface RemoteBroadcastSong {
  songId: string;
  title: string;
  artist: string;
  videoId: string;
  coverUrl?: string;
  album?: string;
  fromDisplayName?: string;
  fromUserId?: string;
  at: number;
}

export interface SessionUser {
  id: string;
  displayName: string;
  joinedAt: number;
  isHost?: boolean;
}

export interface CollabChatMessage {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  sentAt: number;
}

export type CollabChatReactions = Record<string, Record<string, string[]>>;

export type CollabConnectionStatus = 'idle' | 'connecting' | 'live' | 'error';

export interface CollabRoomApi {
  isConfigured: boolean;
  roomCode: string;
  currentUserId: string;
  currentSongId: string | null;
  currentSongTitle: string | null;
  currentSongArtist: string | null;
  isJoined: boolean;
  pendingCode: string;
  setPendingCode: (value: string) => void;
  users: SessionUser[];
  hostUser: SessionUser | null;
  isSyncing: boolean;
  followAlong: boolean;
  remoteSong: RemoteBroadcastSong | null;
  chatMessages: CollabChatMessage[];
  chatReactions: CollabChatReactions;
  chatNotice: string;
  copied: boolean;
  statusMessage: string;
  connectionStatus: CollabConnectionStatus;
  createRoom: () => void;
  joinRoom: (event?: FormEvent) => void;
  leaveRoom: () => void;
  copyRoomCode: () => void;
  setSyncing: (value: boolean) => void;
  setFollowAlong: (value: boolean) => void;
  playRemoteSong: (song: RemoteBroadcastSong) => void;
  sendChatMessage: (text: string) => boolean;
  sendChatReaction: (messageId: string, emoji: string) => void;
}

interface UseCollabRoomOptions {
  currentSongId: string | null;
  currentSongTitle?: string | null;
  currentSongArtist?: string | null;
  currentSongVideoId?: string | null;
  currentSongCoverUrl?: string | null;
  currentSongAlbum?: string | null;
  onRemoteSong?: (song: RemoteBroadcastSong) => void;
}

const ROOM_STORAGE_KEY = 'whisky-room-code';
// v2 keys: the v1 keys were auto-written with `false` on first mount, so every
// existing listener silently had "Broadcast my track" and "Listen along" turned
// off — the room connected but nobody ever heard the host. The new keys only
// record an explicit choice, and the default is ON.
const SYNC_STORAGE_KEY = 'whisky-room-sync-v2';
const FOLLOW_STORAGE_KEY = 'whisky-room-follow-v2';
// After we play a song that arrived from someone else's broadcast, suppress
// re-broadcasting that same track for a short window — otherwise two listeners
// with "Broadcast my track" + "Listen along" enabled echo each other forever
// and the song restarts in an infinite loop.
const ECHO_SUPPRESS_MS = 5000;

// Chat is broadcast-only. Nothing is persisted, so a listener who joins later
// starts with an empty thread — by design.
const CHAT_MAX_LENGTH = 500;
const CHAT_MAX_MESSAGES = 200;
const CHAT_MIN_INTERVAL_MS = 1000;
const CHAT_WINDOW_MS = 10000;
const CHAT_WINDOW_MAX = 8;
const CHAT_REACTION_MIN_INTERVAL_MS = 350;

function applyChatReaction(
  current: CollabChatReactions,
  messageId: string,
  emoji: string,
  userId: string,
  active: boolean,
): CollabChatReactions {
  const messageReactions = current[messageId] ?? {};
  const users = messageReactions[emoji] ?? [];
  const nextUsers = active
    ? users.includes(userId)
      ? users
      : [...users, userId]
    : users.filter((id) => id !== userId);
  const nextMessage = { ...messageReactions };
  if (nextUsers.length > 0) nextMessage[emoji] = nextUsers;
  else delete nextMessage[emoji];
  const next = { ...current };
  if (Object.keys(nextMessage).length > 0) next[messageId] = nextMessage;
  else delete next[messageId];
  return next;
}

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function readStoredCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(ROOM_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function readStoredFlag(key: string, defaultValue = true): boolean {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? defaultValue : stored === '1';
  } catch {
    return defaultValue;
  }
}

function writeStoredFlag(key: string, value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // Storage unavailable — preference just won't persist.
  }
}

/**
 * Owns the Supabase realtime room (presence + now-playing broadcast).
 *
 * Lives in App.tsx so the connection survives navigation between pages —
 * previously the room channel was tied to the collab page component, so
 * switching to the library to pick a song silently closed the room and
 * reset every toggle.
 */
export function useCollabRoom({
  currentSongId,
  currentSongTitle,
  currentSongArtist,
  currentSongVideoId,
  currentSongCoverUrl,
  currentSongAlbum,
  onRemoteSong,
}: UseCollabRoomOptions): CollabRoomApi {
  const storedCode = useMemo(readStoredCode, []);
  const [roomCode, setRoomCode] = useState<string>(storedCode);
  const [isJoined, setIsJoined] = useState<boolean>(() => Boolean(storedCode));
  const [pendingCode, setPendingCode] = useState('');
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(() => readStoredFlag(SYNC_STORAGE_KEY));
  const [followAlong, setFollowAlongState] = useState<boolean>(() => readStoredFlag(FOLLOW_STORAGE_KEY));
  const [remoteSong, setRemoteSong] = useState<RemoteBroadcastSong | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<CollabConnectionStatus>('idle');
  const [chatMessages, setChatMessages] = useState<CollabChatMessage[]>([]);
  const [chatReactions, setChatReactions] = useState<CollabChatReactions>({});
  const [chatNotice, setChatNotice] = useState('');

  const channelRef = useRef<any>(null);
  const userIdRef = useRef('');
  const displayNameRef = useRef('Listener');
  const joinedAtRef = useRef(0);
  const followAlongRef = useRef(followAlong);
  const onRemoteSongRef = useRef(onRemoteSong);
  const isSyncingRef = useRef(isSyncing);
  const songRef = useRef({
    id: currentSongId,
    title: currentSongTitle,
    artist: currentSongArtist,
    videoId: currentSongVideoId,
    coverUrl: currentSongCoverUrl,
    album: currentSongAlbum,
  });
  const echoRef = useRef<{ videoId: string; at: number } | null>(null);
  const userCountRef = useRef(0);
  const chatLastSentRef = useRef(0);
  const chatSentAtRef = useRef<number[]>([]);
  const chatReactionLastSentRef = useRef(0);
  const chatNoticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    followAlongRef.current = followAlong;
  }, [followAlong]);
  useEffect(() => {
    onRemoteSongRef.current = onRemoteSong;
  }, [onRemoteSong]);
  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);
  useEffect(() => {
    songRef.current = {
      id: currentSongId,
      title: currentSongTitle,
      artist: currentSongArtist,
      videoId: currentSongVideoId,
      coverUrl: currentSongCoverUrl,
      album: currentSongAlbum,
    };
  }, [currentSongId, currentSongTitle, currentSongArtist, currentSongVideoId, currentSongCoverUrl, currentSongAlbum]);

  useEffect(() => {
    writeStoredFlag(SYNC_STORAGE_KEY, isSyncing);
  }, [isSyncing]);
  useEffect(() => {
    writeStoredFlag(FOLLOW_STORAGE_KEY, followAlong);
  }, [followAlong]);
  useEffect(() => () => {
    if (chatNoticeTimerRef.current !== null) {
      window.clearTimeout(chatNoticeTimerRef.current);
    }
  }, []);

  const showChatNotice = (message: string) => {
    setChatNotice(message);
    if (chatNoticeTimerRef.current !== null) {
      window.clearTimeout(chatNoticeTimerRef.current);
    }
    chatNoticeTimerRef.current = window.setTimeout(() => setChatNotice(''), 2400);
  };

  const broadcastCurrentSong = (channel: any) => {
    const song = songRef.current;
    if (!isSyncingRef.current || !song.id || !song.videoId) return;
    const echo = echoRef.current;
    if (echo && echo.videoId === song.videoId && Date.now() - echo.at < ECHO_SUPPRESS_MS) return;
    channel.send({
      type: 'broadcast',
      event: 'now-playing',
      payload: {
        songId: song.id,
        title: song.title ?? '',
        artist: song.artist ?? '',
        videoId: song.videoId,
        coverUrl: song.coverUrl ?? '',
        album: song.album ?? '',
        fromUserId: userIdRef.current,
        fromDisplayName: displayNameRef.current,
        at: Date.now(),
      },
    });
  };

  useEffect(() => {
    if (!isJoined || !roomCode || !supabase) return;

    let isCancelled = false;
    setConnectionStatus('connecting');
    userCountRef.current = 0;

    const setup = async () => {
      try {
        const { data } = await supabase!.auth.getUser();
        // The room may have been left (or the app navigated) while we awaited —
        // bail out instead of subscribing a channel nobody will ever clean up.
        if (isCancelled) return;

        const user = data.user ?? null;
        const fallbackId = `guest-${Math.random().toString(36).slice(2, 10)}`;
        userIdRef.current = user?.id ?? fallbackId;
        const fullName = user?.user_metadata?.full_name;
        displayNameRef.current =
          (typeof fullName === 'string' && fullName.trim()) ||
          user?.email?.split('@')[0] ||
          `Guest ${fallbackId.slice(-3).toUpperCase()}`;
        joinedAtRef.current = Date.now();

        const channel = supabase!.channel(`whisky-room-${roomCode}`, {
          config: { presence: { key: userIdRef.current } },
        });

        channel.on('presence', { event: 'sync' }, () => {
          if (isCancelled) return;
          const state = channel.presenceState() as Record<
            string,
            Array<{ presence_ref?: string; id?: string; displayName?: string; joinedAt?: number }>
          >;
          const flat: SessionUser[] = [];
          const seenRefs = new Set<string>();
          Object.values(state).forEach((entries) => {
            entries.forEach((entry) => {
              if (!entry?.id) return;
              if (entry.presence_ref) {
                if (seenRefs.has(entry.presence_ref)) return;
                seenRefs.add(entry.presence_ref);
              }
              flat.push({
                id: entry.id,
                displayName: entry.displayName || 'Listener',
                joinedAt: typeof entry.joinedAt === 'number' ? entry.joinedAt : 0,
              });
            });
          });
          flat.sort((a, b) => a.joinedAt - b.joinedAt);
          // A dropped/reconnected socket can leave the same account tracked twice
          // for a few seconds (old presence_ref + new one). Collapse duplicates by
          // id so each person appears exactly once.
          const seenIds = new Set<string>();
          const unique = flat.filter((entry) => {
            if (seenIds.has(entry.id)) return false;
            seenIds.add(entry.id);
            return true;
          });
          // Rebuild host flag every sync — mutating only the first entry used to
          // leave a stale `isHost: true` behind on whoever hosted before.
          unique.forEach((entry, index) => {
            entry.isHost = index === 0;
          });
          const isHostNow = unique[0]?.id === userIdRef.current;

          const previousCount = userCountRef.current;
          userCountRef.current = unique.length;
          setUsers(unique);

          // Someone new joined while a track is playing — the host re-broadcasts so
          // the newcomer immediately sees (and can follow) what's already on. Only
          // the host does this; letting every client rebroadcast caused duplicate
          // now-playing messages whenever someone joined.
          if (unique.length > previousCount && previousCount > 0 && isHostNow) {
            broadcastCurrentSong(channel);
          }
        });

      channel.on('presence', { event: 'join' }, ({ newPresences }: { newPresences: SessionUser[] }) => {
        const newUser = newPresences?.[0];
        if (newUser && newUser.id !== userIdRef.current) {
          setStatusMessage(`${newUser.displayName} joined the room`);
          window.setTimeout(() => setStatusMessage(''), 2400);
        }
      });

      channel.on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: SessionUser[] }) => {
        const goneUser = leftPresences?.[0];
        if (goneUser && goneUser.id !== userIdRef.current) {
          setStatusMessage(`${goneUser.displayName} left the room`);
          window.setTimeout(() => setStatusMessage(''), 2400);
        }
      });

        // Receive now-playing broadcasts from other listeners. Show the remote
        // song in the UI and, if follow-along is on, hand it to App.tsx so it
        // actually plays locally.
        channel.on('broadcast', { event: 'now-playing' }, ({ payload }: { payload: RemoteBroadcastSong }) => {
          if (isCancelled || !payload || payload.fromUserId === userIdRef.current) return;
          echoRef.current = { videoId: payload.videoId, at: Date.now() };
          setRemoteSong(payload);
          if (followAlongRef.current) {
            onRemoteSongRef.current?.(payload);
          }
        });

        channel.on('broadcast', { event: 'chat-message' }, ({ payload }: { payload: CollabChatMessage }) => {
          if (isCancelled || !payload?.id || !payload.text || payload.userId === userIdRef.current) return;
          const text = String(payload.text).slice(0, CHAT_MAX_LENGTH);
          setChatMessages((prev) => [...prev, { ...payload, text }].slice(-CHAT_MAX_MESSAGES));
        });

        channel.on(
          'broadcast',
          { event: 'chat-reaction' },
          ({ payload }: { payload: { messageId?: string; emoji?: string; userId?: string; active?: boolean } }) => {
            if (isCancelled || !payload?.messageId || !payload.emoji || !payload.userId) return;
            if (payload.userId === userIdRef.current) return;
            setChatReactions((prev) =>
              applyChatReaction(prev, payload.messageId!, payload.emoji!, payload.userId!, payload.active !== false),
            );
          },
        );

        // Register the channel before subscribing: if the component unmounts (or
        // the room changes) while the join handshake is in flight, cleanup must be
        // able to unsubscribe it — otherwise it stays joined forever.
        channelRef.current = channel;

        channel.subscribe((status: string) => {
          if (isCancelled) return;
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('live');
            void channel
              .track({
                id: userIdRef.current,
                displayName: displayNameRef.current,
                joinedAt: joinedAtRef.current,
              })
              .catch(() => {});
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionStatus('error');
          }
        });
      } catch (err) {
        if (!isCancelled) {
          console.warn('[collab] room setup failed:', err);
          setConnectionStatus('error');
        }
      }
    };

    void setup();

    return () => {
      isCancelled = true;
      const channel = channelRef.current;
      channelRef.current = null;
      userCountRef.current = 0;
      if (channel) {
        channel.untrack().catch(() => {});
        channel.unsubscribe();
      }
      setUsers([]);
      setChatMessages([]);
      setChatReactions({});
      setChatNotice('');
      setConnectionStatus('idle');
    };
  }, [isJoined, roomCode]);

  // Push the current track whenever it changes, sync is toggled on, or the
  // channel just came live (covers joining a room mid-song).
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || connectionStatus !== 'live') return;
    broadcastCurrentSong(channel);
  }, [
    currentSongId,
    currentSongTitle,
    currentSongArtist,
    currentSongVideoId,
    currentSongCoverUrl,
    currentSongAlbum,
    isSyncing,
    connectionStatus,
  ]);

  const createRoom = () => {
    const code = generateRoomCode();
    setRoomCode(code);
    try {
      window.localStorage.setItem(ROOM_STORAGE_KEY, code);
    } catch {
      // Ignore — room still works for this session.
    }
    setRemoteSong(null);
    echoRef.current = null;
    setChatMessages([]);
    setChatReactions({});
    setChatNotice('');
    chatLastSentRef.current = 0;
    chatSentAtRef.current = [];
    chatReactionLastSentRef.current = 0;
    // A host expects whatever they play to reach the room.
    setIsSyncing(true);
    setFollowAlongState(true);
    setIsJoined(true);
  };

  const joinRoom = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = pendingCode.trim().toUpperCase();
    if (trimmed.length < 4) {
      setStatusMessage('Room codes must be at least 4 characters.');
      window.setTimeout(() => setStatusMessage(''), 2200);
      return;
    }
    setRoomCode(trimmed);
    try {
      window.localStorage.setItem(ROOM_STORAGE_KEY, trimmed);
    } catch {
      // Ignore — room still works for this session.
    }
    setPendingCode('');
    setRemoteSong(null);
    echoRef.current = null;
    setChatMessages([]);
    setChatReactions({});
    setChatNotice('');
    chatLastSentRef.current = 0;
    chatSentAtRef.current = [];
    chatReactionLastSentRef.current = 0;
    // Joining someone's room means "play what they're playing" — without this
    // the listener only saw the remote card and had to find and click Play.
    setFollowAlongState(true);
    setIsJoined(true);
  };

  const leaveRoom = () => {
    setIsJoined(false);
    setIsSyncing(false);
    setRoomCode('');
    setRemoteSong(null);
    echoRef.current = null;
    setChatMessages([]);
    setChatReactions({});
    setChatNotice('');
    chatLastSentRef.current = 0;
    chatSentAtRef.current = [];
    chatReactionLastSentRef.current = 0;
    try {
      window.localStorage.removeItem(ROOM_STORAGE_KEY);
    } catch {
      // Ignore.
    }
  };

  const copyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setStatusMessage('Could not copy to clipboard.');
      window.setTimeout(() => setStatusMessage(''), 2000);
    }
  };

  const setSyncing = (value: boolean) => {
    setIsSyncing(value);
  };

  const setFollowAlong = (value: boolean) => {
    setFollowAlongState(value);
    // If a remote song is already queued and the user just opted in, use this
    // click as the user-gesture to start playback — Chromium autoplay
    // heuristics need a fresh interaction.
    if (value && remoteSong) {
      onRemoteSongRef.current?.(remoteSong);
    }
  };

  const playRemoteSong = (song: RemoteBroadcastSong) => {
    onRemoteSongRef.current?.(song);
  };

  const sendChatMessage = (rawText: string): boolean => {
    const text = rawText.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LENGTH);
    if (!text) return false;
    const channel = channelRef.current;
    if (!channel || connectionStatus !== 'live') {
      showChatNotice('Chat is still connecting.');
      return false;
    }
    const now = Date.now();
    if (now - chatLastSentRef.current < CHAT_MIN_INTERVAL_MS) {
      showChatNotice('Slow down a little.');
      return false;
    }
    const recent = chatSentAtRef.current.filter((sentAt) => now - sentAt < CHAT_WINDOW_MS);
    if (recent.length >= CHAT_WINDOW_MAX) {
      showChatNotice('Message limit reached. Try again in a moment.');
      return false;
    }
    chatLastSentRef.current = now;
    chatSentAtRef.current = [...recent, now];

    const message: CollabChatMessage = {
      id: `chat-${now}-${Math.random().toString(36).slice(2, 8)}`,
      userId: userIdRef.current,
      displayName: displayNameRef.current,
      text,
      sentAt: now,
    };
    void channel
      .send({ type: 'broadcast', event: 'chat-message', payload: message })
      .catch(() => showChatNotice('Message could not be sent.'));
    setChatMessages((prev) => [...prev, message].slice(-CHAT_MAX_MESSAGES));
    return true;
  };

  const sendChatReaction = (messageId: string, emoji: string) => {
    const channel = channelRef.current;
    if (!channel || connectionStatus !== 'live') {
      showChatNotice('Chat is still connecting.');
      return;
    }
    const now = Date.now();
    if (now - chatReactionLastSentRef.current < CHAT_REACTION_MIN_INTERVAL_MS) return;
    chatReactionLastSentRef.current = now;
    const active = !(chatReactions[messageId]?.[emoji] ?? []).includes(userIdRef.current);
    const payload = {
      messageId,
      emoji,
      userId: userIdRef.current,
      displayName: displayNameRef.current,
      active,
      at: now,
    };
    void channel
      .send({ type: 'broadcast', event: 'chat-reaction', payload })
      .catch(() => showChatNotice('Reaction could not be sent.'));
    setChatReactions((prev) => applyChatReaction(prev, messageId, emoji, userIdRef.current, active));
  };

  const hostUser = useMemo(() => users.find((u) => u.isHost) ?? null, [users]);

  return {
    isConfigured: Boolean(supabase),
    roomCode,
    currentUserId: userIdRef.current,
    currentSongId,
    currentSongTitle: currentSongTitle ?? null,
    currentSongArtist: currentSongArtist ?? null,
    isJoined,
    pendingCode,
    setPendingCode,
    users,
    hostUser,
    isSyncing,
    followAlong,
    remoteSong,
    chatMessages,
    chatReactions,
    chatNotice,
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
    sendChatMessage,
    sendChatReaction,
  };
}

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Sparkles } from 'lucide-react';

interface MultiUserSessionProps {
  currentSongId: string | null;
  onJoinSession?: () => void;
  onSyncToggle?: (sync: boolean) => void;
}

interface SessionUser {
  id: string;
  displayName: string;
}

export function MultiUserSession({ currentSongId, onJoinSession, onSyncToggle }: MultiUserSessionProps) {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!supabase || !currentSongId) return;
    let channel: any;
    let userId = '';
    let displayName = 'Listener';


    const getUserInfo = async () => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? Math.random().toString(36).slice(2);
      displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Listener';

      channel = supabase.channel(`song-presence-${currentSongId}`, {
        config: { presence: { key: userId } }
      });

      channel.on('presence:sync', {}, () => {
        const state = channel.presenceState() as Record<string, SessionUser[]>;
        // Flatten all users
        const allUsers = Object.values(state).flat();
        setUsers(allUsers);
      });

      channel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ id: userId, displayName });
        }
      });
    };

    getUserInfo();

    return () => {
      channel?.unsubscribe();
    };
  }, [currentSongId]);

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-6 h-6 text-accent" />
        <h2 className="text-2xl font-bold">Live Listeners</h2>
      </div>
      <div className="flex gap-4 mb-8">
        <button
          className="px-4 py-2 rounded bg-accent text-white font-semibold hover:bg-accent/80 transition"
          onClick={onJoinSession}
        >
          Join Session
        </button>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isSyncing}
            onChange={e => {
              setIsSyncing(e.target.checked);
              onSyncToggle?.(e.target.checked);
            }}
            className="accent-accent"
          />
          Sync Playback
        </label>
      </div>
      <ul className="space-y-3">
        {users.length === 0 && <li className="text-muted-foreground">No other listeners on this song.</li>}
        {users.map((user) => (
          <li key={user.id} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span>{user.displayName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

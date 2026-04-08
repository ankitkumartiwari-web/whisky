import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Song {
  id: string;
  title: string;
  artist: string;
  thumbnailId: string;
  duration: string | null;
  source: "youtube";
}

interface PlayerState {
  queue: Song[];
  currentIndex: number;
  currentSong: Song | null;
  isPlaying: boolean;
  playSong: (song: Song) => void;
  addToQueue: (song: Song) => void;
  playNext: () => void;
  playPrevious: () => void;
  setQueue: (songs: Song[]) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: 0,
      currentSong: null,
      isPlaying: false,
      playSong: (song: Song) => {
        const idx = get().queue.findIndex((s: Song) => s.id === song.id);
        set({
          currentSong: song,
          currentIndex: idx !== -1 ? idx : get().queue.length,
          queue: idx !== -1 ? get().queue : [...get().queue, song],
          isPlaying: true,
        });
      },
      addToQueue: (song: Song) => {
        if (!get().queue.find((s: Song) => s.id === song.id)) {
          set({ queue: [...get().queue, song] });
        }
      },
      playNext: () => {
        const { queue, currentIndex } = get();
        if (currentIndex < queue.length - 1) {
          set({
            currentIndex: currentIndex + 1,
            currentSong: queue[currentIndex + 1],
            isPlaying: true,
          });
        }
      },
      playPrevious: () => {
        const { queue, currentIndex } = get();
        if (currentIndex > 0) {
          set({
            currentIndex: currentIndex - 1,
            currentSong: queue[currentIndex - 1],
            isPlaying: true,
          });
        }
      },
      setQueue: (songs: Song[]) => {
        set({ queue: songs, currentIndex: 0, currentSong: songs[0] || null });
      },
    }),
    {
      name: 'whisky_queue',
      partialize: (state: PlayerState) => ({ queue: state.queue, currentIndex: state.currentIndex }),
      onRehydrateStorage: (state: PlayerState) => {
        if (state.queue && state.queue.length > 0) {
          state.currentSong = state.queue[state.currentIndex] || null;
        }
      },
    }
  )
);

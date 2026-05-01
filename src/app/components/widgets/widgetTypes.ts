import type { Song } from '../../data/mockData';
import type { OnboardingPreferences } from '../OnboardingModal';

export interface WidgetContext {
  currentSong: Song | null;
  isPlaying: boolean;
  recentSongs: Song[];
  likedSongs: Song[];
  onboardingPrefs: OnboardingPreferences | null;
  onPlaySong: (song: Song) => void;
  onPlayPause: () => void;
  onSelectMood: (moodId: string) => void;
}

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  iconKey: 'now-playing' | 'recent' | 'top-artists' | 'mood' | 'liked' | 'curator' | 'downloads' | 'stats';
  Component: React.ComponentType<{ ctx: WidgetContext; onRemove: () => void }>;
  PageComponent: React.ComponentType<{ ctx: WidgetContext }>;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number;
  isLiked: boolean;
  videoId?: string;
  genre?: string;
  releaseYear?: number | null;
  country?: string;
  artistId?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  songCount: number;
}

export const mockSongs: Song[] = [];

export const mockPlaylists: Playlist[] = [];

export const recentlyPlayed: Song[] = [];
export const trendingSongs: Song[] = [];
export const recommendedSongs: Song[] = [];

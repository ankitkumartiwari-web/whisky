export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number;
  isLiked: boolean;
  videoId?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  songCount: number;
}

export const mockSongs: Song[] = [
  {
    id: '1',
    title: 'Midnight Dreams',
    artist: 'Luna Wave',
    album: 'Nocturnal Sessions',
    coverUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    duration: 245,
    isLiked: true,
    videoId: 'dQw4w9WgXcQ',
  },
  {
    id: '2',
    title: 'Electric Soul',
    artist: 'The Vinyls',
    album: 'Retro Future',
    coverUrl: 'https://img.youtube.com/vi/3JZ_D3ELwOQ/hqdefault.jpg',
    duration: 198,
    isLiked: false,
    videoId: '3JZ_D3ELwOQ',
  },
  {
    id: '3',
    title: 'Abstract Rhythms',
    artist: 'Neo Sounds',
    album: 'Digital Canvas',
    coverUrl: 'https://img.youtube.com/vi/L_jWHffIx5E/hqdefault.jpg',
    duration: 312,
    isLiked: true,
    videoId: 'L_jWHffIx5E',
  },
  {
    id: '4',
    title: 'Stage Lights',
    artist: 'Concert Collective',
    album: 'Live at Madison',
    coverUrl: 'https://img.youtube.com/vi/9bZkp7q19f0/hqdefault.jpg',
    duration: 276,
    isLiked: false,
    videoId: '9bZkp7q19f0',
  },
  {
    id: '5',
    title: 'Silent Melodies',
    artist: 'Echo Chamber',
    album: 'Headphone Dreams',
    coverUrl: 'https://img.youtube.com/vi/OPf0YbXqDm0/hqdefault.jpg',
    duration: 189,
    isLiked: true,
    videoId: 'OPf0YbXqDm0',
  },
  {
    id: '6',
    title: 'Festival Vibes',
    artist: 'Crowd Surge',
    album: 'Summer Anthems',
    coverUrl: 'https://img.youtube.com/vi/2vjPBrBU-TM/hqdefault.jpg',
    duration: 234,
    isLiked: false,
    videoId: '2vjPBrBU-TM',
  },
  {
    id: '7',
    title: 'Neon Waves',
    artist: 'Synthwave Collective',
    album: 'Digital Horizon',
    coverUrl: 'https://img.youtube.com/vi/fJ9rUzIMcZQ/hqdefault.jpg',
    duration: 267,
    isLiked: true,
    videoId: 'fJ9rUzIMcZQ',
  },
  {
    id: '8',
    title: 'Guitar Dreams',
    artist: 'String Theory',
    album: 'Acoustic Sessions',
    coverUrl: 'https://img.youtube.com/vi/ktvTqknDobU/hqdefault.jpg',
    duration: 223,
    isLiked: false,
    videoId: 'ktvTqknDobU',
  },
  {
    id: '9',
    title: 'DJ Revolution',
    artist: 'Turntable Masters',
    album: 'Mix & Blend',
    coverUrl: 'https://img.youtube.com/vi/60ItHLz5WEA/hqdefault.jpg',
    duration: 298,
    isLiked: true,
    videoId: '60ItHLz5WEA',
  },
  {
    id: '10',
    title: 'Piano Nocturne',
    artist: 'Keys & Ivory',
    album: 'Classical Modern',
    coverUrl: 'https://img.youtube.com/vi/5qap5aO4i9A/hqdefault.jpg',
    duration: 341,
    isLiked: false,
    videoId: '5qap5aO4i9A',
  },
  {
    id: '11',
    title: 'Studio Session',
    artist: 'Microphone Check',
    album: 'Recording Booth',
    coverUrl: 'https://img.youtube.com/vi/3tmd-ClpJxA/hqdefault.jpg',
    duration: 256,
    isLiked: true,
    videoId: '3tmd-ClpJxA',
  },
  {
    id: '12',
    title: 'Jazz Nights',
    artist: 'The Saxophonists',
    album: 'Smooth Grooves',
    coverUrl: 'https://img.youtube.com/vi/7NOSDKb0HlU/hqdefault.jpg',
    duration: 289,
    isLiked: false,
    videoId: '7NOSDKb0HlU',
  },
];

export const mockPlaylists: Playlist[] = [
  {
    id: 'p1',
    name: 'Chill Vibes',
    description: 'Relax and unwind with these mellow tunes',
    coverUrl: 'https://images.unsplash.com/photo-1557090740-19c52e6270a8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtdXNpYyUyMGhlYWRwaG9uZXMlMjBhZXN0aGV0aWN8ZW58MXx8fHwxNzczNDEzODY4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    songCount: 42,
  },
  {
    id: 'p2',
    name: 'Workout Mix',
    description: 'High energy tracks to power your exercise',
    coverUrl: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtdXNpYyUyMGZlc3RpdmFsJTIwY3Jvd2R8ZW58MXx8fHwxNzczNDM4NjIwfDA&ixlib=rb-4.1.0&q=80&w=1080',
    songCount: 35,
  },
  {
    id: 'p3',
    name: 'Romantic Evening',
    description: 'Perfect soundtrack for a romantic night',
    coverUrl: 'https://images.unsplash.com/photo-1546058256-47154de4046c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaWFubyUyMGtleXMlMjBibGFjayUyMHdoaXRlfGVufDF8fHx8MTc3MzQzOTQ4NHww&ixlib=rb-4.1.0&q=80&w=1080',
    songCount: 28,
  },
  {
    id: 'p4',
    name: 'Sad Songs',
    description: 'When you need to feel the emotions',
    coverUrl: 'https://images.unsplash.com/photo-1644855640845-ab57a047320e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtdXNpYyUyMGFsYnVtJTIwY292ZXIlMjBhcnR8ZW58MXx8fHwxNzczNDI2MjQyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    songCount: 31,
  },
  {
    id: 'p5',
    name: 'AI Mix: Your Taste',
    description: 'Curated by AI based on your listening history',
    coverUrl: 'https://images.unsplash.com/photo-1770320606275-4815544d5292?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG11c2ljJTIwYXJ0fGVufDF8fHx8MTc3MzQzOTQ4MXww&ixlib=rb-4.1.0&q=80&w=1080',
    songCount: 50,
  },
  {
    id: 'p6',
    name: 'Discover Weekly',
    description: 'Fresh tracks picked just for you',
    coverUrl: 'https://images.unsplash.com/photo-1597279393696-d5701aee7bf7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZW9uJTIwbXVzaWMlMjB3YXZlc3xlbnwxfHx8fDE3NzM0Mzk0ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    songCount: 30,
  },
];

export const recentlyPlayed: Song[] = mockSongs.slice(0, 6);
export const trendingSongs: Song[] = mockSongs.slice(3, 9);
export const recommendedSongs: Song[] = mockSongs.slice(0, 6);

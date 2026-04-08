import { Playlist, Song } from './mockData';

export interface SongMetadata {
  songId: string;
  genre: string;
  language: string;
  energy: 'low' | 'medium' | 'high';
  moods: string[];
  activities: string[];
  timeOfDay: string[];
  isInstrumental: boolean;
  artistBio: string;
  originType: 'movie' | 'album';
  originTitle: string;
  originYear: number;
}

export interface ArtistMetadata {
  name: string;
  bio: string;
  genres: string[];
  topSongIds: string[];
}

export interface OriginMetadata {
  type: 'movie' | 'album';
  title: string;
  year: number;
  language: string;
  soundtrackSongIds: string[];
  description: string;
}

export const songMetadataById: Record<string, SongMetadata> = {
  '1': {
    songId: '1',
    genre: 'Ambient Electronic',
    language: 'English',
    energy: 'low',
    moods: ['dreamy', 'night', 'calm'],
    activities: ['study', 'reading', 'relax'],
    timeOfDay: ['late-night'],
    isInstrumental: false,
    artistBio: 'Luna Wave blends warm synth textures with cinematic vocals.',
    originType: 'album',
    originTitle: 'Nocturnal Sessions',
    originYear: 2024,
  },
  '2': {
    songId: '2',
    genre: 'Nu-Disco',
    language: 'English',
    energy: 'high',
    moods: ['retro', 'groovy', 'uplifting'],
    activities: ['workout', 'party', 'driving'],
    timeOfDay: ['evening'],
    isInstrumental: false,
    artistBio: 'The Vinyls are known for retro grooves with modern production.',
    originType: 'album',
    originTitle: 'Retro Future',
    originYear: 2023,
  },
  '3': {
    songId: '3',
    genre: 'Experimental Electronic',
    language: 'Instrumental',
    energy: 'medium',
    moods: ['focused', 'futuristic', 'atmospheric'],
    activities: ['coding', 'focus', 'design'],
    timeOfDay: ['night', 'day'],
    isInstrumental: true,
    artistBio: 'Neo Sounds explores abstract rhythms for deep focus sessions.',
    originType: 'album',
    originTitle: 'Digital Canvas',
    originYear: 2025,
  },
  '4': {
    songId: '4',
    genre: 'Live Rock',
    language: 'English',
    energy: 'high',
    moods: ['anthemic', 'crowd', 'electric'],
    activities: ['workout', 'running', 'festival'],
    timeOfDay: ['evening', 'night'],
    isInstrumental: false,
    artistBio: 'Concert Collective delivers stadium-ready live performances.',
    originType: 'movie',
    originTitle: 'Stage Lights',
    originYear: 2022,
  },
  '5': {
    songId: '5',
    genre: 'Lo-fi Chill',
    language: 'Instrumental',
    energy: 'low',
    moods: ['soft', 'nostalgic', 'calm'],
    activities: ['sleep', 'focus', 'journaling'],
    timeOfDay: ['late-night', 'early-morning'],
    isInstrumental: true,
    artistBio: 'Echo Chamber creates lo-fi textures and intimate melodies.',
    originType: 'album',
    originTitle: 'Headphone Dreams',
    originYear: 2021,
  },
  '6': {
    songId: '6',
    genre: 'Festival EDM',
    language: 'English',
    energy: 'high',
    moods: ['hype', 'summer', 'bold'],
    activities: ['workout', 'running', 'party'],
    timeOfDay: ['day', 'evening'],
    isInstrumental: false,
    artistBio: 'Crowd Surge crafts high-impact drops built for big stages.',
    originType: 'movie',
    originTitle: 'Summer Anthems',
    originYear: 2020,
  },
  '7': {
    songId: '7',
    genre: 'Synthwave',
    language: 'English',
    energy: 'medium',
    moods: ['neon', 'retro', 'night-drive'],
    activities: ['driving', 'gaming', 'focus'],
    timeOfDay: ['night'],
    isInstrumental: false,
    artistBio: 'Synthwave Collective revives 80s textures with modern sound design.',
    originType: 'album',
    originTitle: 'Digital Horizon',
    originYear: 2024,
  },
  '8': {
    songId: '8',
    genre: 'Acoustic',
    language: 'English',
    energy: 'low',
    moods: ['warm', 'organic', 'reflective'],
    activities: ['relax', 'reading', 'coffee'],
    timeOfDay: ['morning', 'evening'],
    isInstrumental: false,
    artistBio: 'String Theory pairs intimate songwriting with acoustic textures.',
    originType: 'movie',
    originTitle: 'Acoustic Sessions',
    originYear: 2019,
  },
  '9': {
    songId: '9',
    genre: 'House',
    language: 'English',
    energy: 'high',
    moods: ['club', 'dynamic', 'uplifting'],
    activities: ['party', 'gym', 'dance'],
    timeOfDay: ['night'],
    isInstrumental: false,
    artistBio: 'Turntable Masters are known for club-driven house sets.',
    originType: 'album',
    originTitle: 'Mix & Blend',
    originYear: 2023,
  },
  '10': {
    songId: '10',
    genre: 'Neo-Classical',
    language: 'Instrumental',
    energy: 'low',
    moods: ['emotional', 'cinematic', 'calm'],
    activities: ['focus', 'reading', 'sleep'],
    timeOfDay: ['night', 'evening'],
    isInstrumental: true,
    artistBio: 'Keys & Ivory writes cinematic piano pieces with modern ambience.',
    originType: 'movie',
    originTitle: 'Classical Modern',
    originYear: 2024,
  },
  '11': {
    songId: '11',
    genre: 'Alt Pop',
    language: 'English',
    energy: 'medium',
    moods: ['creative', 'urban', 'confident'],
    activities: ['focus', 'commute', 'work'],
    timeOfDay: ['day', 'evening'],
    isInstrumental: false,
    artistBio: 'Microphone Check merges studio polish with expressive hooks.',
    originType: 'album',
    originTitle: 'Recording Booth',
    originYear: 2022,
  },
  '12': {
    songId: '12',
    genre: 'Jazz',
    language: 'Instrumental',
    energy: 'medium',
    moods: ['smooth', 'late-night', 'classic'],
    activities: ['dinner', 'study', 'relax'],
    timeOfDay: ['late-night', 'evening'],
    isInstrumental: true,
    artistBio: 'The Saxophonists deliver smooth jazz rooted in live improvisation.',
    originType: 'movie',
    originTitle: 'Smooth Grooves',
    originYear: 2021,
  },
};

export const artistMetadataByName: Record<string, ArtistMetadata> = {
  'Luna Wave': {
    name: 'Luna Wave',
    bio: 'Luna Wave is an ambient electronic project focused on dreamy nighttime soundscapes.',
    genres: ['Ambient', 'Electronic'],
    topSongIds: ['1'],
  },
  'The Vinyls': {
    name: 'The Vinyls',
    bio: 'The Vinyls fuse nu-disco rhythms with retro synth melodies.',
    genres: ['Nu-Disco', 'Pop'],
    topSongIds: ['2'],
  },
  'Neo Sounds': {
    name: 'Neo Sounds',
    bio: 'Neo Sounds creates abstract electronic instrumentals for deep concentration.',
    genres: ['Experimental', 'Electronic'],
    topSongIds: ['3'],
  },
  'Concert Collective': {
    name: 'Concert Collective',
    bio: 'Concert Collective is a live rock ensemble with cinematic stage energy.',
    genres: ['Rock', 'Live'],
    topSongIds: ['4'],
  },
  'Echo Chamber': {
    name: 'Echo Chamber',
    bio: 'Echo Chamber crafts lo-fi and downtempo mood tracks.',
    genres: ['Lo-fi', 'Chill'],
    topSongIds: ['5'],
  },
  'Crowd Surge': {
    name: 'Crowd Surge',
    bio: 'Crowd Surge produces festival-ready EDM and dance anthems.',
    genres: ['EDM', 'Dance'],
    topSongIds: ['6'],
  },
  'Synthwave Collective': {
    name: 'Synthwave Collective',
    bio: 'Synthwave Collective blends retro-futuristic synth tones with modern beats.',
    genres: ['Synthwave', 'Electronic'],
    topSongIds: ['7'],
  },
  'String Theory': {
    name: 'String Theory',
    bio: 'String Theory writes acoustic songs with organic and intimate textures.',
    genres: ['Acoustic', 'Indie'],
    topSongIds: ['8'],
  },
  'Turntable Masters': {
    name: 'Turntable Masters',
    bio: 'Turntable Masters focuses on energetic house and club mixes.',
    genres: ['House', 'Dance'],
    topSongIds: ['9'],
  },
  'Keys & Ivory': {
    name: 'Keys & Ivory',
    bio: 'Keys & Ivory specializes in emotional piano compositions.',
    genres: ['Neo-Classical', 'Instrumental'],
    topSongIds: ['10'],
  },
  'Microphone Check': {
    name: 'Microphone Check',
    bio: 'Microphone Check delivers polished alt-pop studio tracks.',
    genres: ['Alt Pop'],
    topSongIds: ['11'],
  },
  'The Saxophonists': {
    name: 'The Saxophonists',
    bio: 'The Saxophonists are a smooth-jazz collective built around live improvisation.',
    genres: ['Jazz'],
    topSongIds: ['12'],
  },
};

export const originMetadataByTitle: Record<string, OriginMetadata> = {
  'Nocturnal Sessions': {
    type: 'album',
    title: 'Nocturnal Sessions',
    year: 2024,
    language: 'English',
    soundtrackSongIds: ['1'],
    description: 'An ambient electronic album designed for late-night listening.',
  },
  'Retro Future': {
    type: 'album',
    title: 'Retro Future',
    year: 2023,
    language: 'English',
    soundtrackSongIds: ['2'],
    description: 'A modern take on disco-inspired retro grooves.',
  },
  'Digital Canvas': {
    type: 'album',
    title: 'Digital Canvas',
    year: 2025,
    language: 'Instrumental',
    soundtrackSongIds: ['3'],
    description: 'A conceptual electronic record for creators and coders.',
  },
  'Stage Lights': {
    type: 'movie',
    title: 'Stage Lights',
    year: 2022,
    language: 'English',
    soundtrackSongIds: ['4'],
    description: 'A live-performance drama with energetic soundtrack themes.',
  },
  'Headphone Dreams': {
    type: 'album',
    title: 'Headphone Dreams',
    year: 2021,
    language: 'Instrumental',
    soundtrackSongIds: ['5'],
    description: 'A mellow lo-fi album built for reflective solo listening.',
  },
  'Summer Anthems': {
    type: 'movie',
    title: 'Summer Anthems',
    year: 2020,
    language: 'English',
    soundtrackSongIds: ['6'],
    description: 'A youth film soundtrack with high-energy festival tracks.',
  },
  'Digital Horizon': {
    type: 'album',
    title: 'Digital Horizon',
    year: 2024,
    language: 'English',
    soundtrackSongIds: ['7'],
    description: 'A synthwave record inspired by neon city nights.',
  },
  'Acoustic Sessions': {
    type: 'movie',
    title: 'Acoustic Sessions',
    year: 2019,
    language: 'English',
    soundtrackSongIds: ['8'],
    description: 'An indie romance soundtrack centered on acoustic ballads.',
  },
  'Mix & Blend': {
    type: 'album',
    title: 'Mix & Blend',
    year: 2023,
    language: 'English',
    soundtrackSongIds: ['9'],
    description: 'A house-focused album with club-ready transitions.',
  },
  'Classical Modern': {
    type: 'movie',
    title: 'Classical Modern',
    year: 2024,
    language: 'Instrumental',
    soundtrackSongIds: ['10'],
    description: 'A contemporary drama featuring piano-led emotional themes.',
  },
  'Recording Booth': {
    type: 'album',
    title: 'Recording Booth',
    year: 2022,
    language: 'English',
    soundtrackSongIds: ['11'],
    description: 'A studio-pop album focused on vocal layering and hooks.',
  },
  'Smooth Grooves': {
    type: 'movie',
    title: 'Smooth Grooves',
    year: 2021,
    language: 'Instrumental',
    soundtrackSongIds: ['12'],
    description: 'A city-night drama with jazz-driven soundtrack motifs.',
  },
};

export function getSongMetadata(songId: string): SongMetadata | null {
  return songMetadataById[songId] ?? null;
}

export function getArtistMetadata(artistName: string): ArtistMetadata | null {
  return artistMetadataByName[artistName] ?? null;
}

export function getOriginMetadata(title: string): OriginMetadata | null {
  return originMetadataByTitle[title] ?? null;
}

export function buildAICatalogPayload(songs: Song[], playlists: Playlist[]) {
  const albumMap = new Map<string, {
    id: string;
    title: string;
    description: string;
    songIds: string[];
    year: number;
    language: string;
    genre: string;
    originType: 'movie' | 'album';
  }>();

  songs.forEach((song) => {
    const songMeta = getSongMetadata(song.id);
    const albumId = songMeta?.originTitle ?? song.album;
    const existing = albumMap.get(albumId);
    const albumEntry = {
      id: albumId,
      title: albumId,
      description: songMeta?.artistBio ?? `${song.artist} - ${albumId}`,
      songIds: existing ? [...existing.songIds, song.id] : [song.id],
      year: songMeta?.originYear ?? 2024,
      language: songMeta?.language ?? 'Unknown',
      genre: songMeta?.genre ?? 'Unknown',
      originType: songMeta?.originType ?? 'album',
    };
    albumMap.set(albumId, albumEntry);
  });

  return {
    songs: songs.map((song) => {
      const songMeta = getSongMetadata(song.id);
      const artistMeta = getArtistMetadata(song.artist);
      return {
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        durationSeconds: song.duration,
        isLiked: song.isLiked,
        genre: songMeta?.genre ?? 'Unknown',
        language: songMeta?.language ?? 'Unknown',
        energy: songMeta?.energy ?? 'medium',
        moods: songMeta?.moods ?? [],
        activities: songMeta?.activities ?? [],
        timeOfDay: songMeta?.timeOfDay ?? [],
        isInstrumental: songMeta?.isInstrumental ?? false,
        originType: songMeta?.originType ?? 'album',
        originTitle: songMeta?.originTitle ?? song.album,
        originYear: songMeta?.originYear ?? 2024,
        artistBio: artistMeta?.bio ?? songMeta?.artistBio ?? '',
      };
    }),
    playlists: playlists.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      songCount: playlist.songCount,
    })),
    albums: Array.from(albumMap.values()),
    artists: Object.values(artistMetadataByName),
    origins: Object.values(originMetadataByTitle),
  };
}

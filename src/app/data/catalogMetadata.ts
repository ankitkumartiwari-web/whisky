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
    genre: 'Pop',
    language: 'English',
    energy: 'high',
    moods: ['uplifting', 'fun', 'nostalgic'],
    activities: ['party', 'driving', 'workout'],
    timeOfDay: ['evening'],
    isInstrumental: false,
    artistBio: 'Rick Astley is an English singer best known for the 1987 hit "Never Gonna Give You Up".',
    originType: 'album',
    originTitle: 'Whenever You Need Somebody',
    originYear: 1987,
  },
  '2': {
    songId: '2',
    genre: 'Funk Pop',
    language: 'English',
    energy: 'high',
    moods: ['groovy', 'celebratory', 'confident'],
    activities: ['party', 'workout', 'driving'],
    timeOfDay: ['evening', 'night'],
    isInstrumental: false,
    artistBio: 'Mark Ronson is a British producer; Bruno Mars is an American pop and funk performer.',
    originType: 'album',
    originTitle: 'Uptown Special',
    originYear: 2014,
  },
  '3': {
    songId: '3',
    genre: 'Pop',
    language: 'English',
    energy: 'medium',
    moods: ['romantic', 'catchy', 'rhythmic'],
    activities: ['driving', 'cardio', 'casual'],
    timeOfDay: ['evening'],
    isInstrumental: false,
    artistBio: 'Ed Sheeran is an English singer-songwriter known for chart-topping pop hits.',
    originType: 'album',
    originTitle: '÷ (Divide)',
    originYear: 2017,
  },
  '4': {
    songId: '4',
    genre: 'Rock',
    language: 'English',
    energy: 'high',
    moods: ['epic', 'theatrical', 'classic'],
    activities: ['singalong', 'driving', 'party'],
    timeOfDay: ['night'],
    isInstrumental: false,
    artistBio: 'Queen is a British rock band led by Freddie Mercury, formed in London in 1970.',
    originType: 'album',
    originTitle: 'A Night at the Opera',
    originYear: 1975,
  },
  '5': {
    songId: '5',
    genre: 'EDM',
    language: 'English',
    energy: 'medium',
    moods: ['emotional', 'atmospheric', 'reflective'],
    activities: ['focus', 'driving', 'gaming'],
    timeOfDay: ['night'],
    isInstrumental: false,
    artistBio: 'Alan Walker is a British-Norwegian electronic music producer.',
    originType: 'album',
    originTitle: 'Different World',
    originYear: 2015,
  },
  '6': {
    songId: '6',
    genre: 'Latin Pop',
    language: 'Spanish',
    energy: 'high',
    moods: ['hot', 'sensual', 'summery'],
    activities: ['party', 'dance', 'beach'],
    timeOfDay: ['day', 'evening'],
    isInstrumental: false,
    artistBio: 'Luis Fonsi is a Puerto Rican singer; Daddy Yankee is a reggaeton pioneer.',
    originType: 'album',
    originTitle: 'Vida',
    originYear: 2017,
  },
  '7': {
    songId: '7',
    genre: 'Hip-Hop / Pop',
    language: 'English',
    energy: 'medium',
    moods: ['emotional', 'tribute', 'reflective'],
    activities: ['driving', 'reflection'],
    timeOfDay: ['evening', 'night'],
    isInstrumental: false,
    artistBio: 'Wiz Khalifa is an American rapper; Charlie Puth is a singer and producer.',
    originType: 'movie',
    originTitle: 'Furious 7: Original Motion Picture Soundtrack',
    originYear: 2015,
  },
  '8': {
    songId: '8',
    genre: 'Pop',
    language: 'English',
    energy: 'high',
    moods: ['playful', 'confident', 'upbeat'],
    activities: ['workout', 'party', 'cardio'],
    timeOfDay: ['day', 'evening'],
    isInstrumental: false,
    artistBio: 'Taylor Swift is an American singer-songwriter and global pop icon.',
    originType: 'album',
    originTitle: '1989',
    originYear: 2014,
  },
  '9': {
    songId: '9',
    genre: 'Pop Rock',
    language: 'English',
    energy: 'medium',
    moods: ['anthemic', 'driving', 'hopeful'],
    activities: ['driving', 'cardio', 'party'],
    timeOfDay: ['evening'],
    isInstrumental: false,
    artistBio: 'OneRepublic is an American pop-rock band led by Ryan Tedder.',
    originType: 'album',
    originTitle: 'Native',
    originYear: 2013,
  },
  '10': {
    songId: '10',
    genre: 'Pop',
    language: 'English',
    energy: 'medium',
    moods: ['sweet', 'romantic', 'fun'],
    activities: ['date', 'party', 'driving'],
    timeOfDay: ['evening'],
    isInstrumental: false,
    artistBio: 'Maroon 5 is an American pop-rock band fronted by Adam Levine.',
    originType: 'album',
    originTitle: 'V',
    originYear: 2014,
  },
  '11': {
    songId: '11',
    genre: 'Soul Pop',
    language: 'English',
    energy: 'low',
    moods: ['emotional', 'longing', 'melancholic'],
    activities: ['reflection', 'reading', 'sleep'],
    timeOfDay: ['night', 'late-night'],
    isInstrumental: false,
    artistBio: 'Adele is an English singer-songwriter known for her powerful soul-pop ballads.',
    originType: 'album',
    originTitle: '25',
    originYear: 2015,
  },
  '12': {
    songId: '12',
    genre: 'K-Pop / Dance',
    language: 'Korean',
    energy: 'high',
    moods: ['fun', 'quirky', 'party'],
    activities: ['party', 'dance', 'workout'],
    timeOfDay: ['evening', 'night'],
    isInstrumental: false,
    artistBio: 'PSY is a South Korean singer best known for the global hit "Gangnam Style".',
    originType: 'album',
    originTitle: 'Psy 6 (Six Rules), Part 1',
    originYear: 2012,
  },
};

export const artistMetadataByName: Record<string, ArtistMetadata> = {
  'Rick Astley': {
    name: 'Rick Astley',
    bio: 'British singer best known for the 1987 hit "Never Gonna Give You Up".',
    genres: ['Pop', 'Dance-Pop'],
    topSongIds: ['1'],
  },
  'Mark Ronson ft. Bruno Mars': {
    name: 'Mark Ronson ft. Bruno Mars',
    bio: 'British producer Mark Ronson teamed with Bruno Mars on the funk-pop smash "Uptown Funk".',
    genres: ['Funk', 'Pop'],
    topSongIds: ['2'],
  },
  'Ed Sheeran': {
    name: 'Ed Sheeran',
    bio: 'English singer-songwriter known for chart-topping pop and acoustic hits.',
    genres: ['Pop', 'Acoustic'],
    topSongIds: ['3'],
  },
  'Queen': {
    name: 'Queen',
    bio: 'British rock band formed in London in 1970, led by Freddie Mercury.',
    genres: ['Rock', 'Classic Rock'],
    topSongIds: ['4'],
  },
  'Alan Walker': {
    name: 'Alan Walker',
    bio: 'British-Norwegian electronic music producer focused on melodic EDM.',
    genres: ['EDM', 'Electronic'],
    topSongIds: ['5'],
  },
  'Luis Fonsi ft. Daddy Yankee': {
    name: 'Luis Fonsi ft. Daddy Yankee',
    bio: 'Puerto Rican collaboration that defined modern Latin pop with "Despacito".',
    genres: ['Latin Pop', 'Reggaeton'],
    topSongIds: ['6'],
  },
  'Wiz Khalifa ft. Charlie Puth': {
    name: 'Wiz Khalifa ft. Charlie Puth',
    bio: 'Hip-hop and pop crossover collaboration behind "See You Again".',
    genres: ['Hip-Hop', 'Pop'],
    topSongIds: ['7'],
  },
  'Taylor Swift': {
    name: 'Taylor Swift',
    bio: 'American singer-songwriter and global pop icon.',
    genres: ['Pop'],
    topSongIds: ['8'],
  },
  'OneRepublic': {
    name: 'OneRepublic',
    bio: 'American pop-rock band led by singer-producer Ryan Tedder.',
    genres: ['Pop Rock'],
    topSongIds: ['9'],
  },
  'Maroon 5': {
    name: 'Maroon 5',
    bio: 'American pop-rock band fronted by Adam Levine.',
    genres: ['Pop', 'Pop Rock'],
    topSongIds: ['10'],
  },
  'Adele': {
    name: 'Adele',
    bio: 'English singer-songwriter known for powerful soul-pop ballads.',
    genres: ['Soul Pop', 'Pop'],
    topSongIds: ['11'],
  },
  'PSY': {
    name: 'PSY',
    bio: 'South Korean singer-songwriter and global K-pop ambassador.',
    genres: ['K-Pop', 'Dance'],
    topSongIds: ['12'],
  },
};

export const originMetadataByTitle: Record<string, OriginMetadata> = {
  'Whenever You Need Somebody': {
    type: 'album',
    title: 'Whenever You Need Somebody',
    year: 1987,
    language: 'English',
    soundtrackSongIds: ['1'],
    description: 'Rick Astley\'s debut album, home to "Never Gonna Give You Up".',
  },
  'Uptown Special': {
    type: 'album',
    title: 'Uptown Special',
    year: 2014,
    language: 'English',
    soundtrackSongIds: ['2'],
    description: 'Mark Ronson\'s fourth studio album with the global smash "Uptown Funk".',
  },
  '÷ (Divide)': {
    type: 'album',
    title: '÷ (Divide)',
    year: 2017,
    language: 'English',
    soundtrackSongIds: ['3'],
    description: 'Ed Sheeran\'s third studio album.',
  },
  'A Night at the Opera': {
    type: 'album',
    title: 'A Night at the Opera',
    year: 1975,
    language: 'English',
    soundtrackSongIds: ['4'],
    description: 'Queen\'s landmark fourth studio album featuring "Bohemian Rhapsody".',
  },
  'Different World': {
    type: 'album',
    title: 'Different World',
    year: 2015,
    language: 'English',
    soundtrackSongIds: ['5'],
    description: 'Alan Walker\'s debut studio album.',
  },
  'Vida': {
    type: 'album',
    title: 'Vida',
    year: 2017,
    language: 'Spanish',
    soundtrackSongIds: ['6'],
    description: 'Luis Fonsi\'s ninth studio album, headlined by "Despacito".',
  },
  'Furious 7: Original Motion Picture Soundtrack': {
    type: 'movie',
    title: 'Furious 7: Original Motion Picture Soundtrack',
    year: 2015,
    language: 'English',
    soundtrackSongIds: ['7'],
    description: 'Companion soundtrack to Furious 7, featuring "See You Again".',
  },
  '1989': {
    type: 'album',
    title: '1989',
    year: 2014,
    language: 'English',
    soundtrackSongIds: ['8'],
    description: 'Taylor Swift\'s pop-defining fifth studio album.',
  },
  'Native': {
    type: 'album',
    title: 'Native',
    year: 2013,
    language: 'English',
    soundtrackSongIds: ['9'],
    description: 'OneRepublic\'s third studio album, including "Counting Stars".',
  },
  'V': {
    type: 'album',
    title: 'V',
    year: 2014,
    language: 'English',
    soundtrackSongIds: ['10'],
    description: 'Maroon 5\'s fifth studio album, featuring "Sugar".',
  },
  '25': {
    type: 'album',
    title: '25',
    year: 2015,
    language: 'English',
    soundtrackSongIds: ['11'],
    description: 'Adele\'s third studio album, opening with "Hello".',
  },
  'Psy 6 (Six Rules), Part 1': {
    type: 'album',
    title: 'Psy 6 (Six Rules), Part 1',
    year: 2012,
    language: 'Korean',
    soundtrackSongIds: ['12'],
    description: 'PSY\'s sixth studio album, anchored by "Gangnam Style".',
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
        coverUrl: song.coverUrl,
        videoId: song.videoId ?? '',
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

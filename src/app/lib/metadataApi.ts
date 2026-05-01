import { isBackendApiAvailable } from './backendAvailability';

export interface MetadataAnnotation {
  fragment: string;
  note: string;
}

export interface SongMetadata {
  source?: string;
  songId: string;
  title: string;
  fullTitle: string;
  artistName: string;
  artistId: string | null;
  artistImageUrl: string | null;
  artistDescription: string;
  songDescription: string;
  albumName: string | null;
  releaseDate: string | null;
  sourceUrl: string | null;
  annotationCount: number;
  topAnnotations: MetadataAnnotation[];
  genre?: string | null;
  language?: string | null;
  originYear?: number | null;
  syncedLyrics?: string | null;
}

interface MetadataResolveResponse {
  metadata?: SongMetadata;
  error?: string;
}

const METADATA_ENDPOINT_CANDIDATES = [
  '/api/metadata/resolve',
  'http://localhost:8787/api/metadata/resolve',
  'http://localhost:8788/api/metadata/resolve',
];

export async function fetchSongMetadata(songTitle: string, artistName = '') {
  const backendReady = await isBackendApiAvailable();
  if (!backendReady) {
    return { data: null };
  }

  const payload = {
    songTitle,
    artistName,
  };

  for (const endpoint of METADATA_ENDPOINT_CANDIDATES) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null) as MetadataResolveResponse | null;
      if (!response.ok) {
        continue;
      }

      return { data };
    } catch {
      continue;
    }
  }

  return { data: null };
}

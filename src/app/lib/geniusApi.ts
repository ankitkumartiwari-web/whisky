export interface GeniusAnnotation {
  fragment: string;
  note: string;
}

export interface GeniusMetadata {
  source?: 'genius' | 'spotify-scraper' | 'ytmusic' | 'google';
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
  geniusUrl: string | null;
  annotationCount: number;
  topAnnotations: GeniusAnnotation[];
  genre?: string | null;
  language?: string | null;
  originYear?: number | null;
}

interface MetadataResolveResponse {
  metadata?: GeniusMetadata;
  error?: string;
}

const METADATA_ENDPOINT_CANDIDATES = [
  '/api/metadata/resolve',
  'http://localhost:8787/api/metadata/resolve',
  'http://localhost:8788/api/metadata/resolve',
];

export async function fetchGeniusMetadata(songTitle: string, artistName = '') {
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

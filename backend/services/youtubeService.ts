// Request deduplication + normalization for YouTube API

export interface Song {
  id: string;
  title: string;
  artist: string;
  thumbnailId: string;
  duration: string | null;
  source: "youtube";
}

export class QuotaExceededError extends Error {}
export class ApiError extends Error {}

const pendingRequests = new Map<string, Promise<Song[]>>();

// Simulated fetch function (replace with real YouTube API call)
async function fetchFromYouTubeAPI(query: string): Promise<any[]> {
  // ...
  return [];
}

function normalizeVideo(item: any): Song {
  return {
    id: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    thumbnailId: item.id.videoId,
    duration: null,
    source: "youtube"
  };
}

export const searchYouTube = async (query: string): Promise<Song[]> => {
  if (pendingRequests.has(query)) {
    return pendingRequests.get(query)!;
  }
  const promise = (async () => {
    try {
      const items = await fetchFromYouTubeAPI(query);
      return items.map(normalizeVideo);
    } catch (e: any) {
      if (e?.message?.includes("quota")) throw new QuotaExceededError("YouTube quota exceeded");
      throw new ApiError(e?.message || "YouTube API error");
    }
  })().finally(() => pendingRequests.delete(query));
  pendingRequests.set(query, promise);
  return promise;
};

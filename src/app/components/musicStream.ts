import YTMusic from 'ytmusic-api';

const ytmusic = new YTMusic();

export async function getDirectAudioUrl(videoId: string): Promise<string | null> {
  try {
    await ytmusic.initialize();
    const song = await ytmusic.getSong(videoId); // or search first
    // song has streaming info in some versions — check docs or use youtubei.js for more reliable .chooseFormat
    return song?.formats?.[0]?.url || song?.adaptiveFormats?.[0]?.url || null; // adjust based on actual response
  } catch (e) {
    console.error(e);
    return null;
  }
}

// Jamendo fallback (use test client_id = 709fa152 for quick testing)
export async function getJamendoStream(query: string) {
  const res = await fetch(
    `https://api.jamendo.com/v3.0/tracks/?client_id=709fa152&format=jsonpretty&limit=5&search=${encodeURIComponent(query)}`
  );
  const data = await res.json();
  return data.results?.[0]?.audio || null; // direct MP3
}
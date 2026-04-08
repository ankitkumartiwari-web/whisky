import { useState } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Playlist, Song } from '../data/mockData';
import { getOriginMetadata, getSongMetadata } from '../data/catalogMetadata';
import { getAICuratorResult, type AICuratorResult } from '../lib/aiCuratorApi';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  aiData?: AICuratorResult;
  isError?: boolean;
}

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  songs: Song[];
  playlists: Playlist[];
  searchResultSongIds: string[];
  onApplyRerank: (songIds: string[]) => void;
}

export function AIAssistant({
  isOpen,
  onClose,
  songs,
  playlists,
  searchResultSongIds,
  onApplyRerank,
}: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I can understand mood, activity, language, time of day, and energy. Ask for recommendations, playlist building, reranking, or song/album details.",
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const songsById = new Map(songs.map((song) => [song.id, song]));
  const playlistsById = new Map(playlists.map((playlist) => [playlist.id, playlist]));

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const prompt = inputValue;
    setInputValue('');
    setIsThinking(true);

    const result = await getAICuratorResult({
      prompt,
      songs,
      playlists,
      searchResultSongIds,
    });

    setIsThinking(false);

    if (result.error) {
      const aiError: Message = {
        id: (Date.now() + 1).toString(),
        text: result.error,
        sender: 'ai',
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, aiError]);
      return;
    }

    const aiData = result.data;
    if (!aiData) {
      return;
    }

    if (aiData.rerankedSongIds.length > 0) {
      onApplyRerank(aiData.rerankedSongIds);
    }

    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: aiData.responseText,
      sender: 'ai',
      timestamp: new Date(),
      aiData,
    };

    setMessages((prev) => [...prev, aiMessage]);
  };

  const quickPrompts = [
    'late-night study, no vocals, 40 mins',
    'more like this but softer',
    'tell me song or album details for Midnight Dreams',
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed right-12 bottom-32 w-[420px] h-[560px] bg-background/45 backdrop-blur-2xl border border-white/20 rounded-3xl flex flex-col overflow-hidden z-50 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25 }}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/20 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-sm">AI Curator</h3>
            </div>
            <motion.button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              whileHover={{ rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl ${
                      message.sender === 'user'
                        ? 'bg-accent text-accent-foreground px-4 py-3'
                        : message.isError
                        ? 'text-destructive border border-destructive/30 bg-destructive/10 px-4 py-3'
                        : 'text-foreground'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.text}</p>

                    {message.aiData && (
                      <div className="mt-4 space-y-3">
                        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                          Intent: {message.aiData.intent}
                        </p>

                        {message.aiData.suggestions.length > 0 && (
                          <div className="space-y-2">
                            {message.aiData.suggestions.slice(0, 4).map((suggestion, suggestionIndex) => {
                              if (suggestion.type === 'song') {
                                const song = songsById.get(suggestion.id);
                                if (!song) return null;
                                return (
                                  <div key={`${suggestion.id}-${suggestionIndex}`} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                                    <p className="text-xs">{song.title} • {song.artist}</p>
                                    <p className="text-[11px] text-muted-foreground mt-1">{suggestion.reason}</p>
                                  </div>
                                );
                              }

                              if (suggestion.type === 'album') {
                                const origin = getOriginMetadata(suggestion.id);
                                return (
                                  <div key={`${suggestion.id}-${suggestionIndex}`} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                                    <p className="text-xs">{origin?.title ?? suggestion.id}</p>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                      {origin ? `${origin.type} • ${origin.year}` : 'Album recommendation'}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-1">{suggestion.reason}</p>
                                  </div>
                                );
                              }

                              const playlist = playlistsById.get(suggestion.id);
                              if (!playlist) return null;
                              return (
                                <div key={`${suggestion.id}-${suggestionIndex}`} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                                  <p className="text-xs">{playlist.name}</p>
                                  <p className="text-[11px] text-muted-foreground mt-1">{suggestion.reason}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {message.aiData.playlistBuilder.songIds.length > 0 && (
                          <div className="rounded-xl bg-accent/10 border border-accent/30 px-3 py-3">
                            <p className="text-xs font-medium">{message.aiData.playlistBuilder.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">{message.aiData.playlistBuilder.description}</p>
                            <p className="text-[11px] mt-2 text-muted-foreground">
                              Song IDs: {message.aiData.playlistBuilder.songIds.join(', ')}
                            </p>
                          </div>
                        )}

                        {message.aiData.details && (
                          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-3 space-y-2">
                            {message.aiData.details.songId && (() => {
                              const song = songsById.get(message.aiData?.details?.songId ?? '');
                              const songMeta = song ? getSongMetadata(song.id) : null;
                              if (!song || !songMeta) return null;
                              return (
                                <div>
                                  <p className="text-xs">Song: {song.title}</p>
                                  <p className="text-[11px] text-muted-foreground">Genre: {songMeta.genre} • Language: {songMeta.language}</p>
                                </div>
                              );
                            })()}

                            {message.aiData.details.artistName && (
                              <p className="text-[11px] text-muted-foreground">Artist: {message.aiData.details.artistName}</p>
                            )}

                            {message.aiData.details.originTitle && (() => {
                              const origin = getOriginMetadata(message.aiData?.details?.originTitle ?? '');
                              if (!origin) return null;
                              return (
                                <p className="text-[11px] text-muted-foreground">
                                  Album: {origin.title} ({origin.year})
                                </p>
                              );
                            })()}

                            {message.aiData.geniusDetails && (
                              <div className="rounded-lg border border-accent/30 bg-accent/10 px-2 py-2">
                                <p className="text-[11px]">Source: {message.aiData.geniusDetails.title} • {message.aiData.geniusDetails.artistName}</p>
                                <p className="text-[11px] text-muted-foreground">Annotations: {message.aiData.geniusDetails.annotationCount}</p>
                                {message.aiData.geniusDetails.geniusUrl && (
                                  <a
                                    href={message.aiData.geniusDetails.geniusUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] text-accent hover:underline"
                                  >
                                    View on Genius
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isThinking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-muted-foreground"
              >
                AI Curator is thinking...
              </motion.div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="px-6 py-3 border-t border-white/20 bg-white/5">
            <div className="flex gap-2">
              {quickPrompts.map((prompt, index) => (
                <motion.button
                  key={index}
                  onClick={() => {
                    setInputValue(prompt);
                  }}
                  className="text-xs px-3 py-2 border border-border rounded-full hover:border-foreground hover:bg-accent/5 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {prompt}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-6 border-t border-white/20 bg-white/5">
            <div className="flex gap-3 items-center bg-background/60 border border-white/15 rounded-full px-5 py-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Ask me anything..."
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
              />
              <motion.button 
                onClick={() => void handleSend()}
                disabled={isThinking}
                className="text-accent hover:text-accent/80 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Send className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

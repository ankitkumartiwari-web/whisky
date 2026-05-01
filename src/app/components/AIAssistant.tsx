import { useEffect, useMemo, useRef, useState } from 'react';
import { Languages, Lightbulb, ListMusic, Loader2, Play, Send, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Song } from '../data/mockData';
import { useTheme } from '../context/ThemeContext';
import { chatWithCurator, type CuratorChatResult, type CuratorTrack } from '../lib/aiCuratorApi';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  data?: CuratorChatResult;
  isError?: boolean;
}

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song | null;
  likedSongs: Song[];
  recentSongs: Song[];
  preferredLanguages: string[];
  onPlaySong: (song: Song) => void;
  onAddToLibrary?: (songs: Song[]) => void;
  contentLanguage: 'English' | 'Hindi';
  onContentLanguageChange: (next: 'English' | 'Hindi') => void;
}

const GREETING_TEXT = {
  English:
    "Hey, I'm Whisky — your music curator. Ask me about an artist's story, a song's backstory, or tell me a vibe and I'll spin up a playlist.",
  Hindi:
    'नमस्ते, मैं Whisky हूँ — आपका म्यूज़िक क्यूरेटर। किसी कलाकार की कहानी पूछिए, किसी गाने का बैकस्टोरी जानिए, या एक vibe बताइए — मैं प्लेलिस्ट बना दूँगा।',
} as const;

export function AIAssistant({
  isOpen,
  onClose,
  currentSong,
  likedSongs,
  recentSongs,
  preferredLanguages,
  onPlaySong,
  onAddToLibrary,
  contentLanguage,
  onContentLanguageChange,
}: AIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: 'greeting', sender: 'ai', text: GREETING_TEXT.English },
  ]);

  useEffect(() => {
    setMessages((prev) =>
      prev.length > 0 && prev[0].id === 'greeting'
        ? [{ id: 'greeting', sender: 'ai', text: GREETING_TEXT[contentLanguage] }, ...prev.slice(1)]
        : prev,
    );
  }, [contentLanguage]);

  const t = (en: string, hi: string) => (contentLanguage === 'Hindi' ? hi : en);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const panelBg = isDark ? '#0d0d10' : '#ffffff';
  const panelText = isDark ? '#f4f4f5' : '#0a0a0a';
  const panelBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const sectionBg = isDark ? '#16161a' : '#f5f5f7';
  const subtleText = isDark ? 'rgba(244,244,245,0.7)' : 'rgba(10,10,10,0.65)';

  useEffect(() => {
    if (!isOpen) return;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, isOpen, isThinking]);

  const quickPrompts = useMemo(() => {
    const prompts: string[] = [];
    if (contentLanguage === 'Hindi') {
      if (currentSong?.artist) prompts.push(`${currentSong.artist} के बारे में 3 रोचक तथ्य बताओ`);
      if (currentSong?.title) prompts.push(`"${currentSong.title}" जैसे गाने सुझाओ`);
      prompts.push('एक लेट-नाइट फोकस प्लेलिस्ट बनाओ');
      prompts.push('बॉलीवुड रोड-ट्रिप मिक्स तैयार करो');
    } else {
      if (currentSong?.artist) prompts.push(`Tell me 3 facts about ${currentSong.artist}`);
      if (currentSong?.title) prompts.push(`Songs that feel like "${currentSong.title}"`);
      prompts.push('Make me a late-night focus playlist');
      if (preferredLanguages[0] === 'Hindi') prompts.push('Curate a Bollywood road-trip mix');
      if (preferredLanguages[0] === 'Punjabi') prompts.push('Punjabi gym energy mix');
      if (preferredLanguages[0] === 'Korean') prompts.push('K-Pop comeback radar');
    }
    return prompts.slice(0, 4);
  }, [currentSong, preferredLanguages, contentLanguage]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || isThinking) return;
    const userMessage: ChatMessage = {
      id: `${Date.now()}-u`,
      sender: 'user',
      text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);

    const result = await chatWithCurator({
      prompt: text,
      currentSong,
      likedSongs,
      recentSongs,
      preferredLanguages,
      responseLanguage: contentLanguage,
    });

    setIsThinking(false);

    if (result.error || !result.data) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-e`,
          sender: 'ai',
          text: result.error ?? 'Something went sideways. Try again?',
          isError: true,
        },
      ]);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-a`,
        sender: 'ai',
        text: result.data!.responseText || 'Here you go.',
        data: result.data,
      },
    ]);
  };

  const playPlaylist = (tracks: CuratorTrack[]) => {
    if (tracks.length === 0) return;
    onPlaySong(tracks[0]);
  };

  const addPlaylistToLibrary = (tracks: CuratorTrack[]) => {
    if (!onAddToLibrary || tracks.length === 0) return;
    onAddToLibrary(tracks);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed right-8 bottom-32 z-[80] flex h-[640px] w-[460px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.96 }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          style={{
            backgroundColor: panelBg,
            color: panelText,
            border: `1px solid ${panelBorder}`,
          }}
        >
          <header
            className="flex items-center justify-between px-6 py-4"
            style={{ backgroundColor: sectionBg, borderBottom: `1px solid ${panelBorder}` }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/30 to-accent/5">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em]" style={{ color: subtleText }}>{t('AI Curator', 'एआई क्यूरेटर')}</p>
                <h3 className="text-sm" style={{ color: panelText }}>Whisky</h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onContentLanguageChange(contentLanguage === 'English' ? 'Hindi' : 'English')}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors"
                style={{
                  backgroundColor: panelBg,
                  border: `1px solid ${panelBorder}`,
                  color: panelText,
                }}
                title={`Content language: ${contentLanguage} — click to switch`}
              >
                <Languages className="h-3.5 w-3.5" />
                <span className="tracking-widest">{contentLanguage === 'English' ? 'EN' : 'HI'}</span>
              </button>
              <motion.button
                onClick={onClose}
                className="rounded-full p-2"
                style={{ color: subtleText }}
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.2 }}
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 space-y-5 overflow-y-auto px-5 py-6 custom-scrollbar"
            style={{ backgroundColor: panelBg }}
          >
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[88%] ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        message.sender === 'user'
                          ? 'bg-accent text-accent-foreground'
                          : message.isError
                          ? 'border border-destructive/30 bg-destructive/10 text-destructive'
                          : ''
                      }`}
                      style={
                        message.sender === 'ai' && !message.isError
                          ? { backgroundColor: sectionBg, color: panelText, border: `1px solid ${panelBorder}` }
                          : undefined
                      }
                    >
                      {message.text}
                    </div>

                    {message.data?.facts && message.data.facts.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="px-1 text-[10px] uppercase tracking-[0.22em] text-amber-400/80">
                          {t('Did you know', 'क्या आप जानते हैं')}
                        </p>
                        {message.data.facts.map((fact, idx) => (
                          <div
                            key={idx}
                            className="flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5"
                          >
                            <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
                            <p className="text-xs leading-relaxed text-foreground/90">{fact}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {message.data?.playlist && message.data.playlist.tracks.length > 0 && (
                      <PlaylistCard
                        playlist={message.data.playlist}
                        contentLanguage={contentLanguage}
                        onPlayAll={() => playPlaylist(message.data!.playlist!.tracks)}
                        onPlayTrack={(track) => onPlaySong(track)}
                        onAddToLibrary={
                          onAddToLibrary
                            ? () => addPlaylistToLibrary(message.data!.playlist!.tracks)
                            : undefined
                        }
                      />
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isThinking && (
              <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('Whisky is curating...', 'Whisky तैयारी कर रहा है...')}
              </div>
            )}
          </div>

          {quickPrompts.length > 0 && (
            <div
              className="flex gap-2 overflow-x-auto px-5 py-3"
              style={{ backgroundColor: sectionBg, borderTop: `1px solid ${panelBorder}` }}
            >
              {quickPrompts.map((qp) => (
                <button
                  key={qp}
                  type="button"
                  onClick={() => void send(qp)}
                  className="flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] transition-colors"
                  style={{
                    backgroundColor: panelBg,
                    color: panelText,
                    border: `1px solid ${panelBorder}`,
                  }}
                >
                  {qp}
                </button>
              ))}
            </div>
          )}

          <div
            className="px-5 py-4"
            style={{ backgroundColor: sectionBg, borderTop: `1px solid ${panelBorder}` }}
          >
            <div
              className="flex items-center gap-3 rounded-full px-4 py-2"
              style={{ backgroundColor: panelBg, border: `1px solid ${panelBorder}` }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder={t('Ask about an artist, vibe, or song...', 'किसी कलाकार, मूड या गाने के बारे में पूछें...')}
                className="flex-1 bg-transparent text-sm focus:outline-none"
                style={{ color: panelText }}
              />
              <motion.button
                onClick={() => void send(input)}
                disabled={isThinking || !input.trim()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-[#0A0A0A] transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface PlaylistCardProps {
  playlist: { name: string; description: string; tracks: CuratorTrack[] };
  onPlayAll: () => void;
  onPlayTrack: (track: CuratorTrack) => void;
  onAddToLibrary?: () => void;
  contentLanguage: 'English' | 'Hindi';
}

function PlaylistCard({ playlist, onPlayAll, onPlayTrack, onAddToLibrary, contentLanguage }: PlaylistCardProps) {
  const lt = (en: string, hi: string) => (contentLanguage === 'Hindi' ? hi : en);
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-white/5 to-white/0">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-accent">
            <ListMusic className="h-3 w-3" /> {lt('Curated playlist', 'क्यूरेटेड प्लेलिस्ट')}
          </p>
          <p className="mt-1 truncate text-sm font-medium text-foreground">{playlist.name}</p>
          {playlist.description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{playlist.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onPlayAll}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-[#0A0A0A] transition-colors hover:bg-[var(--accent)]"
        >
          <Play className="h-3 w-3 fill-current" /> {lt('Play all', 'सभी चलाएँ')}
        </button>
      </div>
      <ul className="divide-y divide-white/5">
        {playlist.tracks.slice(0, 8).map((track, idx) => (
          <li key={`${track.id}-${idx}`} className="group flex items-center gap-3 px-4 py-2.5">
            <span className="w-5 text-center text-[11px] text-muted-foreground group-hover:hidden">
              {idx + 1}
            </span>
            <button
              type="button"
              onClick={() => onPlayTrack(track)}
              className="hidden h-5 w-5 items-center justify-center rounded-full bg-foreground/90 text-background group-hover:flex"
              aria-label={`Play ${track.title}`}
            >
              <Play className="h-3 w-3 fill-current" />
            </button>
            <img
              src={track.coverUrl}
              alt=""
              className="h-9 w-9 flex-shrink-0 rounded-md object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-foreground">{track.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{track.artist}</p>
            </div>
          </li>
        ))}
      </ul>
      {onAddToLibrary && (
        <div className="border-t border-white/10 px-4 py-2">
          <button
            type="button"
            onClick={onAddToLibrary}
            className="w-full text-[11px] text-muted-foreground hover:text-foreground"
          >
            {lt('Add all to library', 'सभी को लाइब्रेरी में जोड़ें')}
          </button>
        </div>
      )}
    </div>
  );
}

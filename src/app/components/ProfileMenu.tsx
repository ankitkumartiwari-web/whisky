import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Disc3, Flame, Headphones, Loader2, Moon, Sparkles, Waves } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

type AvatarStyleId = 'monogram' | 'vinyl' | 'moon' | 'waves' | 'spark' | 'flame' | 'headphones';

interface AvatarStyle {
  id: AvatarStyleId;
  label: string;
  gradient: string;
  icon: LucideIcon | null;
  iconClass?: string;
}

const AVATAR_STYLES: AvatarStyle[] = [
  { id: 'monogram', label: 'Monogram', gradient: 'from-accent to-accent-strong', icon: null },
  { id: 'vinyl', label: 'Vinyl', gradient: 'from-[#F0B48C] to-[#9C8BD4]', icon: Disc3 },
  { id: 'moon', label: 'Moonlight', gradient: 'from-[#9C8BD4] to-[#61528C]', icon: Moon },
  { id: 'waves', label: 'Waves', gradient: 'from-[#8FD9CC] to-[#5C8FB8]', icon: Waves },
  { id: 'spark', label: 'Spark', gradient: 'from-[#F6D3B8] to-[#E09A6C]', icon: Sparkles },
  { id: 'flame', label: 'Ember', gradient: 'from-[#F0B48C] to-[#C2555F]', icon: Flame },
  { id: 'headphones', label: 'Headphones', gradient: 'from-[#9FB8EE] to-[#6C6BB0]', icon: Headphones },
];

const AVATAR_IDS = new Set<string>(AVATAR_STYLES.map((style) => style.id));

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function readAvatarStyle(value: unknown): AvatarStyleId {
  return typeof value === 'string' && AVATAR_IDS.has(value) ? (value as AvatarStyleId) : 'monogram';
}

function AvatarBadge({
  styleId,
  name,
  size,
}: {
  styleId: AvatarStyleId;
  name: string;
  size: 'sm' | 'md' | 'lg';
}) {
  const style = AVATAR_STYLES.find((entry) => entry.id === styleId) ?? AVATAR_STYLES[0];
  const Icon = style.icon;
  const box = size === 'lg' ? 'h-16 w-16 text-lg' : size === 'md' ? 'h-11 w-11' : 'h-9 w-9';
  const iconBox = size === 'lg' ? 'h-7 w-7' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span
      className={`flex ${box} flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${style.gradient} shadow-soft`}
    >
      {Icon ? (
        <Icon className={`${iconBox} text-white`} strokeWidth={1.9} />
      ) : (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">
          {initialsFromName(name)}
        </span>
      )}
    </span>
  );
}

interface ProfileMenuProps {
  displayName: string;
  onNameChange?: (name: string) => void;
}

export function ProfileMenu({ displayName, onNameChange }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyleId>('monogram');
  const [name, setName] = useState(displayName);
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setName(displayName);
  }, [displayName]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      setAvatarStyle(readAvatarStyle(meta.avatar_style));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const user = data.user;
      const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
      setEmail(user?.email ?? '');
      setName(typeof meta.full_name === 'string' && meta.full_name.trim() ? meta.full_name : displayName);
      setBio(typeof meta.bio === 'string' ? meta.bio : '');
      setAvatarStyle(readAvatarStyle(meta.avatar_style));
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, displayName]);

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const previewName = useMemo(() => name.trim() || displayName, [name, displayName]);

  const handleSave = async () => {
    const cleanName = name.trim().slice(0, 40);
    if (cleanName.length < 2) {
      setNotice('Display name needs at least 2 characters.');
      return;
    }
    if (!supabase) {
      setNotice('Profile editing is unavailable right now.');
      return;
    }
    setIsSaving(true);
    setNotice('');
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: cleanName,
        bio: bio.trim().slice(0, 140),
        avatar_style: avatarStyle,
      },
    });
    setIsSaving(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    onNameChange?.(cleanName);
    setNotice('Profile updated');
    window.setTimeout(() => {
      setNotice('');
      setIsOpen(false);
    }, 900);
  };

  return (
    <div className="app-region-no-drag relative" ref={rootRef}>
      <motion.button
        type="button"
        onClick={() => {
          setNotice('');
          setIsOpen((open) => !open);
        }}
        className="rounded-full ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-accent/50"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open profile"
        aria-expanded={isOpen}
        title={displayName}
      >
        <AvatarBadge styleId={avatarStyle} name={displayName} size="md" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 top-full z-50 mt-3 w-[22rem] rounded-[1.75rem] border border-border/80 bg-popover/95 p-5 shadow-float backdrop-blur-2xl"
            role="dialog"
            aria-label="Edit profile"
          >
            <div className="flex items-start gap-4">
              <AvatarBadge styleId={avatarStyle} name={previewName} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your profile</p>
                <p className="truncate text-lg leading-tight">{previewName}</p>
                {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Display name
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={40}
                  className="w-full rounded-2xl border border-border bg-secondary/60 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent/60 focus:bg-secondary"
                  placeholder="Your name"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Bio
                </span>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={140}
                  rows={2}
                  className="w-full resize-none rounded-2xl border border-border bg-secondary/60 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent/60 focus:bg-secondary"
                  placeholder="Late-night listener, vinyl hoarder…"
                />
                <span className="mt-1 block text-right text-[10px] text-muted-foreground/70">
                  {bio.length}/140
                </span>
              </label>

              <div>
                <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Avatar
                </span>
                <div className="grid grid-cols-7 gap-2">
                  {AVATAR_STYLES.map((style) => {
                    const Icon = style.icon;
                    const isActive = style.id === avatarStyle;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setAvatarStyle(style.id)}
                        title={style.label}
                        aria-label={style.label}
                        aria-pressed={isActive}
                        className={`relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${style.gradient} transition-transform hover:scale-105 ${
                          isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-popover' : 'opacity-85 hover:opacity-100'
                        }`}
                      >
                        {Icon ? (
                          <Icon className="h-4.5 w-4.5 text-white" strokeWidth={1.9} />
                        ) : (
                          <span className="text-[10px] font-semibold uppercase text-accent-foreground">
                            {initialsFromName(previewName)}
                          </span>
                        )}
                        {isActive && (
                          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-soft">
                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {notice && (
                <p
                  className={`text-xs ${
                    notice === 'Profile updated' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {notice}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save changes
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

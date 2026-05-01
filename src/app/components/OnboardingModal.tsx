import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';

export interface OnboardingPreferences {
  languages: string[];
  genres: string[];
  moods: string[];
  energy: 'low' | 'medium' | 'high';
  completedAt: string;
}

interface OnboardingModalProps {
  isOpen: boolean;
  displayName: string;
  onComplete: (prefs: OnboardingPreferences) => void;
  onSkip?: () => void;
}

const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Spanish', 'Korean', 'Punjabi', 'Tamil', 'Telugu', 'Japanese', 'French'];
const GENRE_OPTIONS = ['Pop', 'Rock', 'Hip-Hop', 'EDM', 'Latin', 'K-Pop', 'Bollywood', 'R&B', 'Indie', 'Jazz', 'Lo-fi', 'Classical'];
const MOOD_OPTIONS = ['Happy', 'Chill', 'Romantic', 'Energetic', 'Focus', 'Workout', 'Party', 'Sad', 'Sleep'];
const ENERGY_OPTIONS: Array<{ id: OnboardingPreferences['energy']; label: string; description: string }> = [
  { id: 'low', label: 'Low', description: 'Soft, mellow, easy listening' },
  { id: 'medium', label: 'Medium', description: 'Balanced — some grooves, some calm' },
  { id: 'high', label: 'High', description: 'Hype, dance, full energy' },
];

interface ChipGroupProps {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  min?: number;
}

function ChipGroup({ options, selected, onToggle }: ChipGroupProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isOn = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`rounded-full border px-4 py-2 text-sm transition-all ${
              isOn
                ? 'border-accent bg-accent text-accent-foreground shadow-lg shadow-accent/20'
                : 'border-border bg-secondary text-foreground hover:border-accent/40 hover:bg-secondary/70'
            }`}
          >
            {isOn && <Check className="mr-1.5 inline h-3.5 w-3.5" />}
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function OnboardingModal({ isOpen, displayName, onComplete, onSkip }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [languages, setLanguages] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [energy, setEnergy] = useState<OnboardingPreferences['energy']>('medium');

  const toggle = (list: string[], setList: (next: string[]) => void) => (option: string) => {
    setList(list.includes(option) ? list.filter((entry) => entry !== option) : [...list, option]);
  };

  const steps = useMemo(
    () => [
      {
        title: 'Which languages do you listen to?',
        subtitle: 'Pick at least one — we will weight recommendations toward these.',
        canAdvance: languages.length > 0,
        body: (
          <ChipGroup options={LANGUAGE_OPTIONS} selected={languages} onToggle={toggle(languages, setLanguages)} />
        ),
      },
      {
        title: 'What genres do you love?',
        subtitle: 'Choose two or more so we can mix things up.',
        canAdvance: genres.length >= 2,
        body: <ChipGroup options={GENRE_OPTIONS} selected={genres} onToggle={toggle(genres, setGenres)} />,
      },
      {
        title: 'How do you usually feel when listening?',
        subtitle: 'Pick the moods you reach for most often.',
        canAdvance: moods.length > 0,
        body: <ChipGroup options={MOOD_OPTIONS} selected={moods} onToggle={toggle(moods, setMoods)} />,
      },
      {
        title: 'And your usual energy level?',
        subtitle: 'We will tune the tempo and vibe accordingly.',
        canAdvance: true,
        body: (
          <div className="grid gap-3">
            {ENERGY_OPTIONS.map((option) => {
              const isOn = energy === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setEnergy(option.id)}
                  className={`flex items-start gap-4 rounded-2xl border p-4 text-left transition-all ${
                    isOn
                      ? 'border-accent bg-accent/10 shadow-lg shadow-accent/10'
                      : 'border-border bg-secondary hover:border-accent/40 hover:bg-secondary/70'
                  }`}
                >
                  <div
                    className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full border ${
                      isOn ? 'border-accent bg-accent text-accent-foreground' : 'border-border'
                    }`}
                  >
                    {isOn && <Check className="h-3 w-3" />}
                  </div>
                  <div>
                    <p className="text-base">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ),
      },
    ],
    [languages, genres, moods, energy],
  );

  const current = steps[step];
  const isLast = step === steps.length - 1;

  if (!isOpen) return null;

  const handleFinish = () => {
    onComplete({
      languages,
      genres,
      moods,
      energy,
      completedAt: new Date().toISOString(),
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.78)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            className="w-full max-w-2xl rounded-3xl p-8 md:p-10 shadow-2xl bg-background text-foreground border border-border"
          >
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Welcome, {displayName}</p>
                <h2 className="text-2xl tracking-tight">Let us tailor your music</h2>
              </div>
            </div>

            <div className="mb-6 flex items-center gap-2">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    idx <= step ? 'bg-accent' : 'bg-border'
                  }`}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-xl">{current.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{current.subtitle}</p>
                </div>
                <div className="pt-2">{current.body}</div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onSkip}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </button>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                )}
                {!isLast ? (
                  <button
                    type="button"
                    disabled={!current.canAdvance}
                    onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinish}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[#0A0A0A] transition-colors hover:bg-[var(--accent)]"
                  >
                    Get my mix <Sparkles className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

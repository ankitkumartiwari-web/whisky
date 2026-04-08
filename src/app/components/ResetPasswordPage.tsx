import { FormEvent, useState } from 'react';
import { motion } from 'motion/react';
import { Disc3, Lock, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { CustomCursor } from './CustomCursor';

interface ResetPasswordPageProps {
  onUpdatePassword: (newPassword: string) => Promise<{ error?: string }>;
  onBack: () => void;
  configError?: string | null;
}

export function ResetPasswordPage({ onUpdatePassword, onBack, configError }: ResetPasswordPageProps) {
  const { theme, toggleTheme } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (configError) {
      setError(configError);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const result = await onUpdatePassword(password);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setNotice('Password updated successfully. You can continue to your account.');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <CustomCursor />

      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -top-28 -left-20 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute top-1/2 right-0 h-96 w-96 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-muted/60 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col px-6 py-8 sm:px-10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Disc3 className="h-8 w-8 text-accent" />
            <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Whisky</p>
          </div>

          <button
            onClick={toggleTheme}
            className="rounded-full border border-border bg-card p-3 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center py-10">
          <div className="grid w-full gap-10 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Account Recovery</p>
              <h1 className="text-5xl leading-tight sm:text-6xl">Set your new password.</h1>
              <p className="max-w-lg text-base text-muted-foreground sm:text-lg">
                Keep your account secure with a strong password. This screen follows the same Whisky theme in both light and dark mode.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-3xl border border-border bg-card/90 p-7 shadow-2xl backdrop-blur-xl sm:p-10"
            >
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label htmlFor="new-password" className="text-sm text-muted-foreground">
                    New Password
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirm-new-password" className="text-sm text-muted-foreground">
                    Confirm New Password
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <input
                      id="confirm-new-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter your password"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                {notice && (
                  <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-foreground">
                    {notice}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-[#1DB954] px-4 py-3 text-sm font-semibold text-[#0A0A0A] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? 'Updating password...' : 'Update Password'}
                </button>
              </form>

              <button
                type="button"
                onClick={onBack}
                className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Back to Sign In
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Disc3, Mail, Lock, Sun, Moon, UserRound } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { CustomCursor } from './CustomCursor';

interface LoginPageProps {
  onSignIn: (email: string, password: string) => Promise<{ error?: string }>;
  onOAuthSignIn: (provider: 'google') => Promise<{ error?: string }>;
  onSignUp: (fullName: string, email: string, password: string) => Promise<{ error?: string; notice?: string }>;
  onRequestPasswordReset: (email: string) => Promise<{ error?: string }>;
  configError?: string | null;
  initialNotice?: string;
  onInitialNoticeShown?: () => void;
}

export function LoginPage({
  onSignIn,
  onOAuthSignIn,
  onSignUp,
  onRequestPasswordReset,
  configError,
  initialNotice,
  onInitialNoticeShown,
}: LoginPageProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const { theme, toggleTheme } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOAuthSubmitting, setIsOAuthSubmitting] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!initialNotice) {
      return;
    }

    setNotice(initialNotice);
    onInitialNoticeShown?.();
  }, [initialNotice, onInitialNoticeShown]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (configError) {
      setError(configError);
      return;
    }

    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (mode === 'signup') {
      if (fullName.trim().length < 2) {
        setError('Please enter your full name.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);

    if (mode === 'signin') {
      const result = await onSignIn(email.trim(), password);
      if (result.error) {
        setError(result.error);
      }
      setIsSubmitting(false);
      return;
    }

    const result = await onSignUp(fullName.trim(), email.trim(), password);
    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    if (result.notice) {
      setNotice(result.notice);
      setMode('signin');
      setPassword('');
      setConfirmPassword('');
    }

    setIsSubmitting(false);
  };

  const switchMode = (nextMode: 'signin' | 'signup') => {
    setMode(nextMode);
    setError('');
    setNotice('');
  };

  const handleOAuth = async (provider: 'google') => {
    setError('');
    setNotice('');

    if (configError) {
      setError(configError);
      return;
    }

    setIsOAuthSubmitting(true);
    const result = await onOAuthSignIn(provider);
    setIsOAuthSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setNotice('Redirecting to Google for secure sign-in...');
  };

  const handleForgotPassword = async () => {
    setError('');
    setNotice('');

    if (configError) {
      setError(configError);
      return;
    }

    if (!email.includes('@')) {
      setError('Enter your account email first, then click Forgot password.');
      return;
    }

    setIsRequestingReset(true);
    const result = await onRequestPasswordReset(email.trim());
    setIsRequestingReset(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setNotice('Password reset email sent. Check your inbox.');
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
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
              </p>
              <h1 className="text-5xl leading-tight sm:text-6xl">
                {mode === 'signin'
                  ? 'Sign in to continue your soundtrack.'
                  : 'Sign up and build your personal music universe.'}
              </h1>
              <p className="max-w-lg text-base text-muted-foreground sm:text-lg">
                Discover personalized playlists, AI-curated mixes, and seamless listening across every mood.
              </p>
              <p className="max-w-lg text-sm text-muted-foreground">
                For verified identity, use Google sign-in.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-3xl border border-border bg-card/90 p-7 shadow-2xl backdrop-blur-xl sm:p-10"
            >
              <div className="mb-5 grid grid-cols-2 rounded-xl border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    mode === 'signin'
                      ? 'bg-[var(--accent)] text-[#0A0A0A] shadow-sm'
                      : 'bg-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    mode === 'signup'
                      ? 'bg-[var(--accent)] text-[#0A0A0A] shadow-sm'
                      : 'bg-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <button
                    type="button"
                    onClick={() => void handleOAuth('google')}
                    disabled={isOAuthSubmitting || isSubmitting}
                    className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-70 w-full"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" focusable="false">
                      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2A9.8 9.8 0 0 0 2.2 12 9.8 9.8 0 0 0 12 21.8c5.7 0 9.5-4 9.5-9.6 0-.6-.1-1.1-.2-1.6H12Z" />
                      <path fill="#FBBC05" d="M3.3 7.4 6.5 9.8A6 6 0 0 1 12 6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2c-3.8 0-7.2 2.2-8.7 5.2Z" />
                      <path fill="#34A853" d="M12 21.8c2.6 0 4.8-.9 6.4-2.5l-3-2.4c-.8.6-1.9 1-3.4 1a6 6 0 0 1-5.6-4.1l-3.3 2.5c1.6 3.1 4.9 5.5 8.9 5.5Z" />
                      <path fill="#4285F4" d="M21.5 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.3 1.3-1 2.4-2.1 3.1l3 2.4c1.7-1.5 2.8-3.9 2.8-6.8Z" />
                    </svg>
                    Continue with Google
                  </button>
                </div>

                <div className="pt-1">
                  <div className="w-full flex justify-center mb-2">
                    <div className="h-0.5 w-[92%] bg-black dark:bg-white transition-colors duration-300" style={{ borderRadius: '9999px' }} />
                  </div>
                  <p className="text-center text-xs uppercase tracking-[0.15em] text-muted-foreground">or use email</p>
                </div>

                {mode === 'signup' && (
                  <div className="space-y-2">
                    <label htmlFor="full-name" className="text-sm text-muted-foreground">
                      Full Name
                    </label>
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                      <input
                        id="full-name"
                        type="text"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        autoComplete="name"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm text-muted-foreground">
                    Email
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm text-muted-foreground">
                    Password
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={mode === 'signin' ? 'Enter your password' : 'Minimum 6 characters'}
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  {mode === 'signin' && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={isRequestingReset}
                        className="text-xs font-medium text-[var(--accent)] hover:underline disabled:opacity-70"
                      >
                        {isRequestingReset ? 'Sending reset email...' : 'Forgot password?'}
                      </button>
                    </div>
                  )}
                </div>

                {mode === 'signup' && (
                  <div className="space-y-2">
                    <label htmlFor="confirm-password" className="text-sm text-muted-foreground">
                      Confirm Password
                    </label>
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <input
                        id="confirm-password"
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
                )}

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
                  disabled={isSubmitting || isOAuthSubmitting}
                  className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#0A0A0A] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting
                    ? mode === 'signin'
                      ? 'Signing in...'
                      : 'Creating account...'
                    : mode === 'signin'
                      ? 'Sign In'
                      : 'Create Account'}
                </button>
              </form>

              <div className="mt-4 text-center text-sm text-muted-foreground">
                {mode === 'signin' ? (
                  <>
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="font-semibold text-[var(--accent)] hover:underline"
                    >
                      Create Account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="font-semibold text-[var(--accent)] hover:underline"
                    >
                      Sign In
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

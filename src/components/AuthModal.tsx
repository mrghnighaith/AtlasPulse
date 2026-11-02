import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Cloud,
  CheckCircle2,
  LogOut,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  Save,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  AuthFormMode,
  FeatureAccessCheckResult,
  validateAuthInput,
  getUserInitials,
} from '../utils/authValidator';
import { AtlasPulseLogo } from './AtlasPulseLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedPlacesCount: number;
  initialMode?: AuthFormMode;
  gatedFeature?: FeatureAccessCheckResult | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  savedPlacesCount,
  initialMode = 'signin',
  gatedFeature = null,
}) => {
  const {
    user,
    authError,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resetPassword,
    updateProfileName,
    signOut,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<AuthFormMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Profile edit state when signed in
  const [profileNameInput, setProfileNameInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSavedNotice, setProfileSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setLocalError(null);
      setStatusNotice(null);
      setProfileSavedNotice(null);
      clearAuthError();
      if (user) {
        setProfileNameInput(user.displayName || user.email?.split('@')[0] || '');
      }
    }
  }, [isOpen, initialMode, user, clearAuthError]);

  if (!isOpen) return null;

  const handleModeSwitch = (nextMode: AuthFormMode) => {
    setMode(nextMode);
    setLocalError(null);
    setStatusNotice(null);
    clearAuthError();
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setStatusNotice(null);
    setIsSubmitting(true);
    try {
      const ok = await signInWithGoogle();
      if (ok) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setStatusNotice(null);
    clearAuthError();

    const validation = validateAuthInput({
      mode,
      email,
      password,
      displayName,
    });

    if (!validation.valid) {
      setLocalError(validation.error || 'Please check your input.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signin') {
        const ok = await signInWithEmail(validation.normalizedEmail, password);
        if (ok) {
          onClose();
        }
      } else if (mode === 'signup') {
        const ok = await registerWithEmail(
          validation.normalizedEmail,
          password,
          validation.normalizedDisplayName
        );
        if (ok) {
          onClose();
        }
      } else if (mode === 'reset') {
        const ok = await resetPassword(validation.normalizedEmail);
        if (ok) {
          setStatusNotice(
            `Password reset instructions have been sent to ${validation.normalizedEmail}.`
          );
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProfileName = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSavedNotice(null);
    setLocalError(null);
    const trimmed = profileNameInput.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setLocalError('Display name must be between 2 and 80 characters.');
      return;
    }
    setIsSavingProfile(true);
    try {
      const ok = await updateProfileName(trimmed);
      if (ok) {
        setProfileSavedNotice('Profile display name updated in Firebase.');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const activeError = localError || authError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      data-testid="auth-modal"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AtlasPulseLogo size="xs" variant="icon-only" withPulseEffect={false} />
            <div>
              <h2
                id="auth-modal-title"
                className="font-display font-bold text-base text-slate-950"
              >
                {user
                  ? 'Account & Cloud Sync'
                  : mode === 'signin'
                  ? 'Sign In to AtlasPulse'
                  : mode === 'signup'
                  ? 'Create Your AtlasPulse Account'
                  : 'Reset Your Password'}
              </h2>
              <p className="text-xs text-slate-500">
                {user
                  ? 'Connected to Firebase Authentication & Firestore'
                  : 'Sync saved places & unlock member-only spatial tools'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            data-testid="close-auth-modal-btn"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[82vh]">
          {user ? (
            /* Authenticated Account View */
            <div className="space-y-5" data-testid="authenticated-profile-view">
              <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User avatar'}
                    className="w-12 h-12 rounded-full object-cover border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
                    {getUserInitials(user.displayName, user.email)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold text-sm text-slate-950 truncate">
                      {user.displayName || 'Explorer'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>Active</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate mt-0.5">
                    {user.email}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                    UID: {user.uid.slice(0, 16)}...
                  </p>
                </div>
              </div>

              {/* Firestore Cloud Sync Status Card */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      Firebase Firestore Cloud Sync
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {savedPlacesCount} saved {savedPlacesCount === 1 ? 'place' : 'places'} backed up to your account
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-blue-700 bg-white px-2.5 py-1 rounded-md border border-blue-200">
                  Real-time
                </span>
              </div>

              {/* Update Display Name Form */}
              <form onSubmit={handleSaveProfileName} className="space-y-2.5">
                <label
                  htmlFor="profile-display-name"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Display Name
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="profile-display-name"
                    type="text"
                    value={profileNameInput}
                    onChange={(e) => setProfileNameInput(e.target.value)}
                    placeholder="Your display name"
                    className="flex-1 px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingProfile ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              </form>

              {profileSavedNotice && (
                <div
                  role="status"
                  className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{profileSavedNotice}</span>
                </div>
              )}

              {activeError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{activeError}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    onClose();
                  }}
                  data-testid="modal-signout-btn"
                  className="px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            /* Unauthenticated Sign In / Sign Up / Reset View */
            <>
              {/* Gated Feature Notice Banner (shown when user clicked a locked feature) */}
              {gatedFeature && !gatedFeature.allowed && (
                <div
                  data-testid="auth-modal-feature-gate-banner"
                  className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 space-y-2"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Sign-In Required: {gatedFeature.featureTitle}</span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    {gatedFeature.reason}
                  </p>
                  <ul className="space-y-1 pt-0.5">
                    {gatedFeature.benefits.map((b, idx) => (
                      <li
                        key={idx}
                        className="text-[11px] text-amber-800 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mode Switcher Tabs */}
              <div
                className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80"
                role="tablist"
                aria-label="Authentication mode"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signin'}
                  data-testid="auth-tab-signin"
                  onClick={() => handleModeSwitch('signin')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    mode === 'signin'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signup'}
                  data-testid="auth-tab-signup"
                  onClick={() => handleModeSwitch('signup')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    mode === 'signup'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Create Account
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'reset'}
                  data-testid="auth-tab-reset"
                  onClick={() => handleModeSwitch('reset')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    mode === 'reset'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Reset Password
                </button>
              </div>

              {/* Google OAuth Button */}
              {mode !== 'reset' && (
                <>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting}
                    data-testid="google-oauth-btn"
                    className="w-full py-2.5 px-4 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2.5 shadow-xs disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>

                  <div className="relative flex items-center justify-center">
                    <div className="border-t border-slate-200 w-full" />
                    <span className="bg-white px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      or with email
                    </span>
                    <div className="border-t border-slate-200 w-full" />
                  </div>
                </>
              )}

              {/* Email & Password Form */}
              <form onSubmit={handleFormSubmit} noValidate className="space-y-3.5">
                {mode === 'signup' && (
                  <div>
                    <label
                      htmlFor="auth-display-name"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Display Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="auth-display-name"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Alex Rivera"
                        autoComplete="name"
                        className="w-full pl-9 pr-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email-input"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full pl-9 pr-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                {mode !== 'reset' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="auth-password-input"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Password
                      </label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => handleModeSwitch('reset')}
                          className="text-[11px] font-medium text-blue-600 hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="auth-password-input"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          mode === 'signup'
                            ? 'At least 8 characters'
                            : 'Enter your password'
                        }
                        autoComplete={
                          mode === 'signup' ? 'new-password' : 'current-password'
                        }
                        className="w-full pl-9 pr-9 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {activeError && (
                  <div
                    role="alert"
                    data-testid="auth-modal-error"
                    className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{activeError}</span>
                  </div>
                )}

                {statusNotice && (
                  <div
                    role="status"
                    data-testid="auth-modal-status"
                    className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{statusNotice}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="auth-submit-btn"
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {mode === 'reset' ? (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>
                        {isSubmitting ? 'Sending Reset Link...' : 'Send Password Reset Email'}
                      </span>
                    </>
                  ) : (
                    <span>
                      {isSubmitting
                        ? 'Authenticating...'
                        : mode === 'signin'
                        ? 'Sign In with Email'
                        : 'Create AtlasPulse Account'}
                    </span>
                  )}
                </button>
              </form>

              {/* Security & Cloud Sync Benefits Footer */}
              <div className="pt-3 border-t border-slate-200/80 flex items-start gap-2.5 text-[11px] text-slate-500">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Secured by <strong>Firebase Authentication</strong> &amp;{' '}
                  <strong>Cloud Firestore</strong>. Your saved places and itineraries are isolated to your account.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

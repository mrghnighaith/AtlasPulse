export type AuthFormMode = 'signin' | 'signup' | 'reset';

export interface AuthFormInput {
  mode: AuthFormMode;
  email: string;
  password?: string;
  displayName?: string;
}

export interface AuthValidationResult {
  valid: boolean;
  error?: string;
  normalizedEmail: string;
  normalizedDisplayName: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates authentication form inputs for Sign In, Create Account, and Password Reset.
 */
export function validateAuthInput(input: AuthFormInput): AuthValidationResult {
  const normalizedEmail = (input.email || '').trim().toLowerCase();
  const normalizedDisplayName = (input.displayName || '').trim();
  const password = input.password || '';

  if (!normalizedEmail) {
    return {
      valid: false,
      error: 'Please enter your email address.',
      normalizedEmail,
      normalizedDisplayName,
    };
  }

  if (!EMAIL_REGEX.test(normalizedEmail) || normalizedEmail.length > 256) {
    return {
      valid: false,
      error: 'Please enter a valid email address (e.g., alex@example.com).',
      normalizedEmail,
      normalizedDisplayName,
    };
  }

  if (input.mode === 'reset') {
    return {
      valid: true,
      normalizedEmail,
      normalizedDisplayName,
    };
  }

  if (input.mode === 'signup') {
    if (!normalizedDisplayName) {
      return {
        valid: false,
        error: 'Please enter your display name.',
        normalizedEmail,
        normalizedDisplayName,
      };
    }
    if (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 80) {
      return {
        valid: false,
        error: 'Display name must be between 2 and 80 characters.',
        normalizedEmail,
        normalizedDisplayName,
      };
    }
  }

  if (!password) {
    return {
      valid: false,
      error: 'Please enter your password.',
      normalizedEmail,
      normalizedDisplayName,
    };
  }

  const minLen = input.mode === 'signup' ? 8 : 6;
  if (password.length < minLen) {
    return {
      valid: false,
      error: `Password must be at least ${minLen} characters long.`,
      normalizedEmail,
      normalizedDisplayName,
    };
  }

  return {
    valid: true,
    normalizedEmail,
    normalizedDisplayName,
  };
}

/**
 * Maps raw Firebase Auth error codes or messages to clear, user-friendly guidance.
 */
export function formatFirebaseAuthError(error: unknown): string {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error || '');

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  const combined = `${code} ${rawMessage}`.toLowerCase();

  if (
    combined.includes('popup-closed-by-user') ||
    combined.includes('cancelled-popup-request')
  ) {
    return '';
  }
  if (
    combined.includes('auth/invalid-credential') ||
    combined.includes('auth/wrong-password') ||
    combined.includes('auth/user-not-found')
  ) {
    return 'Invalid email or password. Please check your credentials or create a new account.';
  }
  if (combined.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (combined.includes('auth/weak-password')) {
    return 'Password is too weak. Please choose a password with at least 8 characters.';
  }
  if (combined.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (combined.includes('auth/popup-blocked')) {
    return 'Sign-in popup was blocked by your browser. Please allow popups or sign in with email and password.';
  }
  if (combined.includes('auth/operation-not-allowed')) {
    return 'This sign-in provider is not yet enabled in the Firebase console. Please use Google Sign-In or enable Email/Password in Firebase Auth.';
  }
  if (combined.includes('auth/too-many-requests')) {
    return 'Too many unsuccessful attempts. Please wait a moment or reset your password.';
  }
  if (combined.includes('auth/unauthorized-domain')) {
    return 'This preview domain is not yet listed in Firebase Authorized Domains, or use Email & Password sign-in.';
  }

  return rawMessage.replace(/^Firebase:\s*/i, '').trim() || 'Authentication failed. Please try again.';
}

/**
 * Generates up to 2 uppercase initials from a user's display name or email.
 */
export function getUserInitials(displayName?: string | null, email?: string | null): string {
  const cleanEmail = email ? email.split('@')[0] : '';
  const source = (displayName || cleanEmail || 'U').trim();
  if (!source) return 'U';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

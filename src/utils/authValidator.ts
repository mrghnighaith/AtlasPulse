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

export type GatedFeatureId =
  | 'save_places'
  | 'route_planner'
  | 'specialist_bots'
  | 'pro_models'
  | 'saved_itinerary_tab';

export interface FeatureAccessCheckResult {
  allowed: boolean;
  featureId: GatedFeatureId;
  featureTitle: string;
  reason: string;
  benefits: string[];
}

export const GATED_FEATURES_CATALOG: Record<
  GatedFeatureId,
  { title: string; reason: string; benefits: string[] }
> = {
  save_places: {
    title: 'Save & Bookmark Places to Cloud',
    reason:
      'Saving places to your personal itinerary requires an authenticated AtlasPulse account.',
    benefits: [
      'Bookmark unlimited Google Maps locations across any city',
      'Real-time cloud backup and sync via Firebase Firestore',
      'Use saved places in the Multi-Stop Route Planner',
    ],
  },
  route_planner: {
    title: 'Multi-Stop Route Planner & Directions',
    reason:
      'Drawing multi-stop walking, driving, cycling, and transit polylines on the map requires you to be signed in.',
    benefits: [
      'Connect 2 or more saved places with Google Directions polylines',
      'Compare Walking, Driving, Cycling, and Transit travel times',
      'Customize route colors and reorder stops interactively',
    ],
  },
  specialist_bots: {
    title: 'Specialist AI Personas (6 Pro Bots)',
    reason:
      'Guest sessions include Local Concierge and Culinary Scout. Sign in to unlock all 8 specialized spatial AI bots.',
    benefits: [
      'Unlock Urban Historian, Mobility & Access, and Nightlife & Music bots',
      'Unlock Nature & Trails, Remote Work Scout, and Family & Access bots',
      'Tailored grounded system instructions for every travel style',
    ],
  },
  pro_models: {
    title: 'Advanced Gemini Spatial Models',
    reason:
      'Switching to Gemini 4 Argon or Gemini Flash Latest requires an authenticated member session.',
    benefits: [
      'Access Gemini 4 Argon for deep multi-constraint spatial synthesis',
      'Access Gemini Flash Latest for rolling grounded search updates',
      'Full multi-turn conversation continuity across roles',
    ],
  },
  saved_itinerary_tab: {
    title: 'Saved Places Itinerary & Cloud Sync',
    reason:
      'Your Saved Places Itinerary and AI Route Builder are member-only features protected by Firebase Authentication.',
    benefits: [
      'Access your curated city bookmarks on both PC and Android Browser',
      'One-click AI itinerary sequencing and route drawing',
      'Protected per-user storage in Firebase Cloud Firestore',
    ],
  },
};

const FREE_GUEST_BOT_ROLES = new Set(['concierge', 'culinary']);
const GATED_PRO_MODELS = new Set(['gemini-4-argon', 'gemini-flash-latest']);

/**
 * Returns true if the given AI bot role requires the user to be logged in.
 */
export function isBotRoleGatedForGuest(roleId: string): boolean {
  return !FREE_GUEST_BOT_ROLES.has(roleId);
}

/**
 * Returns true if the given Gemini model requires the user to be logged in.
 */
export function isModelGatedForGuest(modelId: string): boolean {
  return GATED_PRO_MODELS.has(modelId);
}

/**
 * Evaluates whether a user can access a specific feature based on authentication status.
 */
export function checkFeatureAccess(
  featureId: GatedFeatureId,
  isAuthenticated: boolean
): FeatureAccessCheckResult {
  const meta =
    GATED_FEATURES_CATALOG[featureId] || GATED_FEATURES_CATALOG.save_places;
  return {
    allowed: Boolean(isAuthenticated),
    featureId,
    featureTitle: meta.title,
    reason: meta.reason,
    benefits: meta.benefits,
  };
}


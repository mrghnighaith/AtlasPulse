import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  onAuthStateChanged,
  signInWithGoogle as firebaseSignInGoogle,
  signInWithEmail as firebaseSignInEmail,
  registerWithEmail as firebaseRegisterEmail,
  sendPasswordReset as firebaseSendPasswordReset,
  updateUserProfileName as firebaseUpdateProfileName,
  signOutUser,
  User,
} from '../lib/firebase';
import { formatFirebaseAuthError } from '../utils/authValidator';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  updateProfileName: (displayName: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authError: null,
  signInWithGoogle: async () => false,
  signInWithEmail: async () => false,
  registerWithEmail: async () => false,
  resetPassword: async () => false,
  updateProfileName: async () => false,
  signOut: async () => {},
  clearAuthError: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (error) => {
        console.error('Auth state change error:', error);
        setAuthError(error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSignInGoogle = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      await firebaseSignInGoogle();
      return true;
    } catch (err: unknown) {
      const formatted = formatFirebaseAuthError(err);
      if (formatted) {
        setAuthError(formatted);
      }
      return false;
    }
  };

  const handleSignInEmail = async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);
    try {
      await firebaseSignInEmail(email, password);
      return true;
    } catch (err: unknown) {
      const formatted = formatFirebaseAuthError(err);
      if (formatted) {
        setAuthError(formatted);
      }
      return false;
    }
  };

  const handleRegisterEmail = async (
    email: string,
    password: string,
    displayName: string
  ): Promise<boolean> => {
    setAuthError(null);
    try {
      await firebaseRegisterEmail(email, password, displayName);
      return true;
    } catch (err: unknown) {
      const formatted = formatFirebaseAuthError(err);
      if (formatted) {
        setAuthError(formatted);
      }
      return false;
    }
  };

  const handleResetPassword = async (email: string): Promise<boolean> => {
    setAuthError(null);
    try {
      await firebaseSendPasswordReset(email);
      return true;
    } catch (err: unknown) {
      const formatted = formatFirebaseAuthError(err);
      if (formatted) {
        setAuthError(formatted);
      }
      return false;
    }
  };

  const handleUpdateProfileName = async (displayName: string): Promise<boolean> => {
    setAuthError(null);
    try {
      await firebaseUpdateProfileName(displayName);
      // Trigger React re-render with updated auth.currentUser
      if (auth.currentUser) {
        setUser({ ...auth.currentUser } as User);
      }
      return true;
    } catch (err: unknown) {
      const formatted = formatFirebaseAuthError(err);
      if (formatted) {
        setAuthError(formatted);
      }
      return false;
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    try {
      await signOutUser();
    } catch (err: unknown) {
      const formatted = formatFirebaseAuthError(err);
      if (formatted) {
        setAuthError(formatted);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        signInWithGoogle: handleSignInGoogle,
        signInWithEmail: handleSignInEmail,
        registerWithEmail: handleRegisterEmail,
        resetPassword: handleResetPassword,
        updateProfileName: handleUpdateProfileName,
        signOut: handleSignOut,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

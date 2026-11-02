import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut as firebaseSignOut,
  User,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocFromServer,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { LivePlaceItem } from '../types/places';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying firestoreDatabaseId
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: boolean | string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: Test connection to Firestore on boot
export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

// Run connection check
void testConnection();

async function upsertUserProfile(user: User, customDisplayName?: string): Promise<void> {
  const userDocRef = doc(db, 'users', user.uid);
  const now = new Date().toISOString();
  const profileData = {
    id: user.uid,
    email: user.email || '',
    displayName: (customDisplayName || user.displayName || user.email?.split('@')[0] || 'Explorer').slice(0, 128),
    photoURL: (user.photoURL || '').slice(0, 1024),
    updatedAt: now,
  };

  try {
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      await setDoc(userDocRef, {
        ...profileData,
        createdAt: now,
      });
    } else {
      await setDoc(userDocRef, profileData, { merge: true });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
  }
}

// Google Sign In with Popup
export async function signInWithGoogle(): Promise<User> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const user = cred.user;
    if (user) {
      await upsertUserProfile(user);
    }
    return user;
  } catch (err: any) {
    console.error('Firebase Auth Sign-In Error:', err);
    throw err;
  }
}

// Email & Password Sign In
export async function signInWithEmail(email: string, password: string): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    if (user) {
      await upsertUserProfile(user);
    }
    return user;
  } catch (err: any) {
    console.error('Firebase Email Sign-In Error:', err);
    throw err;
  }
}

// Email & Password Account Registration
export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    if (user) {
      await updateProfile(user, { displayName });
      await upsertUserProfile(user, displayName);
    }
    return user;
  } catch (err: any) {
    console.error('Firebase Registration Error:', err);
    throw err;
  }
}

// Send Password Reset Email
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err: any) {
    console.error('Firebase Password Reset Error:', err);
    throw err;
  }
}

// Update current user display name in Firebase Auth and Firestore
export async function updateUserProfileName(displayName: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to update your profile.');
  }
  const trimmed = displayName.trim().slice(0, 128);
  await updateProfile(currentUser, { displayName: trimmed });
  await upsertUserProfile(currentUser, trimmed);
}

// Sign Out
export async function signOutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.error('Firebase Sign-Out Error:', err);
    throw err;
  }
}

// Sync saved place into Firestore
export async function savePlaceToFirestore(
  userId: string,
  place: LivePlaceItem
): Promise<void> {
  const placeDocPath = `users/${userId}/saved_places/${place.id}`;
  try {
    const placeDocRef = doc(db, 'users', userId, 'saved_places', place.id);
    const payload: Record<string, any> = {
      id: place.id,
      displayName: place.displayName,
      formattedAddress: place.formattedAddress,
      lat: place.location.lat,
      lng: place.location.lng,
      savedAt: new Date().toISOString(),
    };

    if (place.rating !== undefined) payload.rating = place.rating;
    if (place.userRatingCount !== undefined)
      payload.userRatingCount = place.userRatingCount;
    if (place.primaryTypeDisplayName)
      payload.primaryTypeDisplayName = place.primaryTypeDisplayName;
    if (place.googleMapsURI) payload.googleMapsURI = place.googleMapsURI;
    if (place.websiteURI) payload.websiteURI = place.websiteURI;

    await setDoc(placeDocRef, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, placeDocPath);
  }
}

// Remove saved place from Firestore
export async function removePlaceFromFirestore(
  userId: string,
  placeId: string
): Promise<void> {
  const placeDocPath = `users/${userId}/saved_places/${placeId}`;
  try {
    const placeDocRef = doc(db, 'users', userId, 'saved_places', placeId);
    await deleteDoc(placeDocRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, placeDocPath);
  }
}

// Listen to saved places from Firestore
export function subscribeToSavedPlaces(
  userId: string,
  onUpdate: (places: LivePlaceItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colPath = `users/${userId}/saved_places`;
  const colRef = collection(db, 'users', userId, 'saved_places');

  return onSnapshot(
    colRef,
    (snapshot) => {
      const places: LivePlaceItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        places.push({
          id: data.id || docSnap.id,
          displayName: data.displayName || 'Saved Place',
          formattedAddress: data.formattedAddress || '',
          location: {
            lat: data.lat || 0,
            lng: data.lng || 0,
          },
          rating: data.rating,
          userRatingCount: data.userRatingCount,
          primaryTypeDisplayName: data.primaryTypeDisplayName,
          googleMapsURI: data.googleMapsURI,
          websiteURI: data.websiteURI,
        });
      });
      onUpdate(places);
    },
    (err) => {
      onError?.(err);
      handleFirestoreError(err, OperationType.LIST, colPath);
    }
  );
}

export { onAuthStateChanged };
export type { User };

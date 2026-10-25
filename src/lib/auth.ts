import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, linkWithPopup } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const sheetsProvider = new GoogleAuthProvider();
sheetsProvider.addScope('https://www.googleapis.com/auth/spreadsheets');

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;

// Cache the access token in memory.
let cachedAccessToken: string | null = null;
let cachedDriveToken: string | null = null;
let currentAppRole: 'owner' | 'editor' | 'viewer' | null = null;
export const setAppRole = (role: typeof currentAppRole) => { currentAppRole = role; };
export const getAppRole = () => currentAppRole;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    console.log('ON AUTH STATE CHANGED:', user ? user.uid : 'null');
    if (user) {
      const isGoogle = user.providerData.some(p => p.providerId === 'google.com');
      let activeToken = getAccessToken();
      
      if (!isGoogle && !activeToken) {
        activeToken = 'dummy_token_for_email_login';
        // In this scope we can't directly assign to cachedAccessToken if it's not exported to module scope, 
        // but it is in the same file. Wait, cachedAccessToken is in this file.
      }

      if (onAuthSuccess) onAuthSuccess(user, activeToken || '');
    } else {
      // cachedAccessToken = null; // wait, let's just let it be
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    cachedAccessToken = null;
    localStorage.removeItem('quickStock_google_oauth_token');
    const result = await signInWithPopup(auth, sheetsProvider);
    const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    if (!token) throw new Error('Google did not grant access to Sheets. Please sign in again.');
    cachedAccessToken = token;
    localStorage.setItem('quickStock_google_oauth_token', token);
    return { user: result.user, accessToken: token };
  } catch (error: any) {
    if (error?.code !== 'auth/popup-closed-by-user') {
      console.error('Sign in error:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const authorizeGoogleSheets = async (): Promise<string | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, sheetsProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google');
    }
    cachedAccessToken = credential.accessToken;
    localStorage.setItem('quickStock_google_oauth_token', credential.accessToken);
    return credential.accessToken;
  } catch (error: any) {
    if (error?.code !== 'auth/popup-closed-by-user') {
      console.error('Authorize Google error:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const authorizeGoogleDrive = async (): Promise<string> => {
  const driveProvider = new GoogleAuthProvider();
  driveProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
  driveProvider.addScope('https://www.googleapis.com/auth/drive');
  driveProvider.setCustomParameters({ prompt: 'consent' });
  const result = await signInWithPopup(auth, driveProvider);
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token) throw new Error('Google Drive permission was not granted.');
  cachedDriveToken = token;
  cachedAccessToken = token;
  localStorage.setItem('quickStock_google_oauth_token', token);
  return token;
};

export const getDriveToken = () => cachedDriveToken;

export const getAccessToken = (): string | null => {
  if (cachedAccessToken && cachedAccessToken !== 'dummy_token_for_email_login') {
    return cachedAccessToken;
  }
  const storedToken = localStorage.getItem('quickStock_google_oauth_token');
  if (storedToken) {
    return storedToken;
  }
  return cachedAccessToken;
};

export const getFirebaseIdToken = async (): Promise<string | null> => auth.currentUser ? auth.currentUser.getIdToken() : null;

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  cachedDriveToken = null;
  localStorage.removeItem('quickStock_google_oauth_token');
};

export const formatAuthEmail = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return 'admin@quickstock.com';
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}@quickstock.com`;
};

export const formatAuthPassword = (raw: string): string => {
  if (!raw) return '123456';
  if (raw.length < 6) {
    return raw.padEnd(6, '0');
  }
  return raw;
};

export const emailSignIn = async (rawEmail: string, rawPassword: string): Promise<{ user: User } | null> => {
  const email = formatAuthEmail(rawEmail);
  const password = formatAuthPassword(rawPassword);
  try {
    isSigningIn = true;
    let result;
    try {
      result = await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-email') {
        result = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        throw err;
      }
    }
    cachedAccessToken = 'dummy_token_for_email_login';
    return { user: result.user };
  } catch (error: any) {
    console.error('Email sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const emailSignUp = async (rawEmail: string, rawPassword: string): Promise<{ user: User } | null> => {
  const email = formatAuthEmail(rawEmail);
  const password = formatAuthPassword(rawPassword);
  try {
    isSigningIn = true;
    const result = await createUserWithEmailAndPassword(auth, email, password);
    cachedAccessToken = 'dummy_token_for_email_login';
    return { user: result.user };
  } catch (error: any) {
    console.error('Email sign up error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const setCachedAccessToken = (token: string | null) => { cachedAccessToken = token; };

export const linkGoogleAccount = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No user is signed in");
    
    const result = await linkWithPopup(currentUser, sheetsProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google');
    }
    cachedAccessToken = credential.accessToken;
    localStorage.setItem('quickStock_google_oauth_token', credential.accessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (error?.code === 'auth/credential-already-in-use') {
      alert("This Google account is already linked to another user. Please sign in directly with Google.");
    } else if (error?.code !== 'auth/popup-closed-by-user') {
      console.error('Link error:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

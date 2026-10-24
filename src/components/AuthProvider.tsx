import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, emailSignIn, emailSignUp, linkGoogleAccount, logout as signOutUser, getFirebaseIdToken, setAppRole } from '../lib/auth';
import { DEFAULT_SPREADSHEET_ID } from '../lib/config';

interface AuthContextType {
  user: User | null;
  hasGoogleAccess: boolean;
  role: 'owner' | 'editor' | 'viewer' | null;
  sharedSheetId: string | null;
  accessLoading: boolean;
  accessError: string | null;
  loginError: string | null;
  loading: boolean;
  isLoggingIn: boolean;
  login: () => Promise<void>;
  emailLogin: (email: string, password: string) => Promise<void>;
  emailRegister: (email: string, password: string) => Promise<void>;
  linkGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  hasGoogleAccess: false,
  role: null,
  sharedSheetId: null,
  accessLoading: false,
  accessError: null,
  loginError: null,
  loading: true,
  isLoggingIn: false,
  login: async () => {},
  emailLogin: async () => {},
  emailRegister: async () => {},
  linkGoogle: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hasGoogleAccess, setHasGoogleAccess] = useState(false);
  const [role, setRole] = useState<'owner' | 'editor' | 'viewer' | null>(null);
  const [sharedSheetId, setSharedSheetId] = useState<string | null>(null);
  const activeUid = useRef<string | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        if (activeUid.current !== user.uid) {
          localStorage.removeItem('quickStock_classesSheetId');
          activeUid.current = user.uid;
          setRole(null);
          setSharedSheetId(null);
          setAppRole(null);
        }
        setUser(user);
        setHasGoogleAccess(Boolean(token) && token !== 'dummy_token_for_email_login');
        setLoading(false);
      },
      () => {
        activeUid.current = null;
        localStorage.removeItem('quickStock_classesSheetId');
        setUser(null);
        setRole(null);
        setSharedSheetId(null);
        setAppRole(null);
        setHasGoogleAccess(false);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setRole(null); return; }
    let active = true;
    setAccessLoading(true);
    setAccessError(null);
    getFirebaseIdToken().then(token => token ? fetch('/api/app-access', { headers: { 'X-Firebase-Token': token }, cache: 'no-store' }) : null)
      .then(async response => {
        if (!response?.ok) throw new Error('Could not verify your app access.');
        const data = await response.json() as { role: 'owner' | 'editor' | 'viewer' | null; workspaceSheetId?: string | null; sharedSheetId?: string | null };
        if (active) {
          const personalKey = `quickstock_sheet_${user.uid}`;
          const selected = data.role === 'owner'
            ? data.workspaceSheetId || localStorage.getItem(personalKey) || DEFAULT_SPREADSHEET_ID
            : data.role ? data.sharedSheetId || data.workspaceSheetId || localStorage.getItem(personalKey) || '' : '';
          if (selected) { localStorage.setItem('quickStock_classesSheetId', selected); localStorage.setItem(`quickstock_active_sheet_${user.uid}`, selected); }
          else localStorage.removeItem('quickStock_classesSheetId');
          if (data.workspaceSheetId) localStorage.setItem(personalKey, data.workspaceSheetId);
          setSharedSheetId(data.sharedSheetId || null);
          setRole(data.role);
          setAppRole(data.role);
          if (data.role) localStorage.setItem(`quickstock_verified_role_${user.uid}`, data.role);
        }
      })
      .catch(error => { if (active) { const cached = !navigator.onLine ? localStorage.getItem(`quickstock_verified_role_${user.uid}`) : null; const offlineRole = cached === 'owner' || cached === 'editor' || cached === 'viewer' ? cached : null; const offlineSheet = offlineRole ? localStorage.getItem(`quickstock_active_sheet_${user.uid}`) : null; if (offlineSheet) localStorage.setItem('quickStock_classesSheetId', offlineSheet); else localStorage.removeItem('quickStock_classesSheetId'); setRole(offlineRole); setAppRole(offlineRole); setAccessError(offlineRole ? 'Offline mode: edits remain on this device until Google confirms your access during sync.' : error.message || 'Could not verify app access.'); } })
      .finally(() => { if (active) setAccessLoading(false); });
    return () => { active = false; };
  }, [user?.uid]);

  const login = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setHasGoogleAccess(false);
      }
    } catch (error) {
      console.error("Login failed", error);
      const failure = error as { code?: string; message?: string };
      setLoginError(failure.code === 'auth/popup-blocked' ? 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.' : failure.code === 'auth/unauthorized-domain' ? 'This site is not authorized in Firebase Authentication. The app owner must add this domain in Firebase Console.' : failure.message || 'Google sign-in failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const emailLogin = async (email: string, password: string) => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const result = await emailSignIn(email, password);
      if (result) {
        setUser(result.user);
        setHasGoogleAccess(false);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to sign in with credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const emailRegister = async (email: string, password: string) => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const result = await emailSignUp(email, password);
      if (result) {
        setUser(result.user);
        setHasGoogleAccess(false);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to register with email.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const linkGoogle = async () => {
    try {
      const result = await linkGoogleAccount();
      if (result) {
        setUser(result.user);
        setHasGoogleAccess(true);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to link Google account.');
    }
  };

  const logout = async () => {
    await signOutUser();
    setUser(null);
    setRole(null);
    setSharedSheetId(null);
    setAppRole(null);
    setHasGoogleAccess(false);
    localStorage.removeItem('quickStock_classesSheetId');
  };

  return (
    <AuthContext.Provider value={{ user, role, sharedSheetId, accessLoading, accessError, loginError, loading, isLoggingIn, login, emailLogin, emailRegister, linkGoogle, logout, hasGoogleAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

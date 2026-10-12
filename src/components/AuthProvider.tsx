import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, emailSignIn, emailSignUp, linkGoogleAccount, logout as signOutUser } from '../lib/auth';
import { DEFAULT_SPREADSHEET_ID } from '../lib/config';

interface AuthContextType {
  user: User | null;
  hasGoogleAccess: boolean;
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
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        if (!localStorage.getItem('quickStock_classesSheetId') || localStorage.getItem('quickStock_classesSheetId') === 'admin_local_spreadsheet_id') {
          localStorage.setItem('quickStock_classesSheetId', DEFAULT_SPREADSHEET_ID);
        }
        setUser(user);
        setHasGoogleAccess(token !== 'dummy_token_for_email_login');
        setLoading(false);
      },
      () => {
        setUser(null);
        setHasGoogleAccess(false);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const login = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setHasGoogleAccess(true);
      }
    } catch (error) {
      console.error("Login failed", error);
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
        if (!localStorage.getItem('quickStock_classesSheetId') || localStorage.getItem('quickStock_classesSheetId') === 'admin_local_spreadsheet_id') {
          localStorage.setItem('quickStock_classesSheetId', DEFAULT_SPREADSHEET_ID);
        }
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
        if (!localStorage.getItem('quickStock_classesSheetId') || localStorage.getItem('quickStock_classesSheetId') === 'admin_local_spreadsheet_id') {
          localStorage.setItem('quickStock_classesSheetId', DEFAULT_SPREADSHEET_ID);
        }
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
    setHasGoogleAccess(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isLoggingIn, login, emailLogin, emailRegister, linkGoogle, logout, hasGoogleAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

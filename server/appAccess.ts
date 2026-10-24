import firebaseConfig from '../firebase-applet-config.json';

export const APP_OWNER_EMAIL = 'sireykun8@gmail.com';
export type AppRole = 'owner' | 'editor' | 'viewer';

type Statement = { bind(...values: unknown[]): Statement; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<unknown> };
export type AccessDB = { prepare(sql: string): Statement };
export type AccessRoleDB = { prepare(sql: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null> } } };

export async function verifiedFirebaseEmail(request: Request): Promise<string | null> {
  const idToken = request.headers.get('X-Firebase-Token');
  if (!idToken || idToken.length > 10000) return null;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const data = await response.json() as { users?: { email?: string; emailVerified?: boolean; providerUserInfo?: { providerId?: string }[] }[] };
  const user = data.users?.[0];
  const email = user?.email?.trim().toLowerCase();
  if (!email || !user?.emailVerified || !email.endsWith('@gmail.com') || !user.providerUserInfo?.some(provider => provider.providerId === 'google.com')) return null;
  return email;
}

export async function accessRole(db: AccessRoleDB, email: string): Promise<AppRole | null> {
  if (email === APP_OWNER_EMAIL) return 'owner';
  const row = await db.prepare("SELECT role FROM app_access WHERE email = ? AND status = 'active'").bind(email).first<{ role: 'editor' | 'viewer' }>();
  return row?.role || null;
}

export type GoogleActor = { sub: string; name: string; email: string };

export function describeSheetMutation(url: URL): { action: string; target: string } {
  const path = decodeURIComponent(url.pathname);
  const range = path.match(/\/values\/([^?]+)/)?.[1] || '';
  const target = range.split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'") || 'Spreadsheet';
  if (path.endsWith(':append')) return { action: 'Added inventory rows', target };
  if (path.includes('/values:batchUpdate')) return { action: 'Updated spreadsheet values', target: 'Multiple sheets' };
  if (path.includes('/values/')) return { action: 'Updated inventory values', target };
  return { action: 'Changed spreadsheet structure', target: 'Spreadsheet' };
}

export async function googleActor(authorization: string): Promise<GoogleActor> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: authorization },
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Could not verify Google account for activity log');
  const profile = await response.json() as { sub?: string; name?: string; email?: string; email_verified?: boolean };
  if (!profile.sub || !profile.email || profile.email_verified === false) throw new Error('Google account email unavailable for activity log');
  const email = profile.email.trim().toLocaleLowerCase();
  return { sub: profile.sub, name: profile.name?.trim() || email.split('@')[0], email };
}

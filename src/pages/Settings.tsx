import React, { useState, useEffect } from "react";
import {
  Save,
  AlertCircle,
  CheckCircle2,
  FilePlus2,
  Moon,
  Sun,
  CalendarDays,
  Ghost,
  TreePine,
  Sparkles,
  KeyRound,
  Check,
  Download,
  Database,
  SlidersHorizontal,
  ShieldCheck,
} from "lucide-react";
import {
  getSpreadsheetMetadata,
  createStarterSheets,
  formatClassColors,
  formatStockColors,
} from "../lib/sheets";
import { useTheme } from "../components/ThemeProvider";
import { canPromptInstall, promptInstall } from "../lib/install";
import { AuditRule, readAuditRules, writeAuditRules } from "../lib/auditRules";
import { useLanguage } from "../components/LanguageProvider";
import { useAuth } from "../components/AuthProvider";
import { getFirebaseIdToken } from "../lib/auth";
import { removeSpreadsheetShare, shareSpreadsheet } from "../lib/driveSharing";

const spreadsheetIdFromInput = (value: string) => value.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)?.[1] || value.trim();
const themeOptions = [
  { id: 'auto', label: 'Auto seasonal', icon: CalendarDays },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'halloween', label: 'Halloween', icon: Ghost },
  { id: 'christmas', label: 'Christmas', icon: TreePine },
  { id: 'new-year', label: 'New Year', icon: Sparkles },
] as const;

function InstallAppCard() {
  const [canInstall, setCanInstall] = useState(canPromptInstall);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const [installing, setInstalling] = useState(false);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const update = () => {
      setCanInstall(canPromptInstall());
      setInstalled(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    };
    window.addEventListener('quick-stock-install-ready', update);
    window.addEventListener('appinstalled', update);
    return () => {
      window.removeEventListener('quick-stock-install-ready', update);
      window.removeEventListener('appinstalled', update);
    };
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setCanInstall(canPromptInstall());
      setInstalling(false);
    }
  };

  return (
    <section id="install-app" className="flex flex-col justify-between gap-4 rounded-[26px] border border-white/90 bg-gradient-to-r from-sky-50 to-cyan-50/70 p-5 shadow-sm dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/70 sm:flex-row sm:items-center">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"><Download className="h-4 w-4" /></span> Use Quick Stock as an app</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          {installed ? 'Quick Stock is on your home screen.' : isIOS ? 'In Safari, tap Share → Add to Home Screen, turn on Open as Web App, then tap Add.' : canInstall ? 'Add Quick Stock to your home screen for one-tap access.' : 'In your browser menu, choose Install app or Install and create shortcut.'}
        </p>
        {!installed && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Google Sheets inventory needs an internet connection.</p>}
      </div>
      {!installed && canInstall && <button type="button" onClick={handleInstall} disabled={installing} className="shrink-0 min-h-11 px-5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold disabled:opacity-50">{installing ? 'Opening install...' : 'Install app'}</button>}
    </section>
  );
}

export function Settings() {
  const [classesSheetId, setClassesSheetId] = useState("");
  const [lowInventoryThreshold, setLowInventoryThreshold] = useState("5");
  const [auditRules, setAuditRules] = useState<AuditRule[]>(() => readAuditRules(localStorage.getItem('quickStock_classesSheetId') || ''));
  const [auditRulesSaved, setAuditRulesSaved] = useState(false);
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { role, user, sharedSheetId, hasGoogleAccess, connectGoogleSheets } = useAuth();
  const [accessMembers, setAccessMembers] = useState<{ email: string; role: 'editor' | 'viewer'; status: 'active' | 'pending' | 'revoked'; invited_at: string | null; last_access_at: string | null; revoked_at: string | null; shared_sheet_id: string | null; drive_permission_id: string | null }[]>([]);
  const [accessEmail, setAccessEmail] = useState('');
  const [accessRole, setAccessRole] = useState<'editor' | 'viewer'>('viewer');
  const [shareSelectedSheet, setShareSelectedSheet] = useState(false);
  const [accessStatus, setAccessStatus] = useState('');
  const [accessBusy, setAccessBusy] = useState(false);

  const loadAccess = async () => {
    const token = await getFirebaseIdToken();
    const response = await fetch('/api/app-access', { headers: { 'X-Firebase-Token': token || '' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load access list.');
    const data = await response.json() as { members?: typeof accessMembers };
    setAccessMembers(data.members || []);
  };

  useEffect(() => {
    if (role === 'owner') loadAccess().catch(error => setAccessStatus(error.message));
  }, [role]);

  const changeAccess = async (email: string, newRole?: 'editor' | 'viewer', shareSheet = shareSelectedSheet) => {
    setAccessBusy(true);
    setAccessStatus('');
    try {
      const token = await getFirebaseIdToken();
      const member = accessMembers.find(entry => entry.email === email);
      const sheetId = spreadsheetIdFromInput(classesSheetId);
      const headers = { 'Content-Type': 'application/json', 'X-Firebase-Token': token || '' };
      if (newRole) {
        if (shareSheet && !sheetId) throw new Error('Save a Google Sheet before sharing it.');
        const response = await fetch('/api/app-access', { method: 'POST', headers, body: JSON.stringify({ email, role: newRole, status: shareSheet ? 'pending' : 'active', sharedSheetId: shareSheet ? sheetId : undefined }) });
        const data = await response.json() as { error?: { message: string } };
        if (!response.ok) throw new Error(data.error?.message || 'Could not save invitation.');
        if (shareSheet) {
          await loadAccess();
          const permissionId = await shareSpreadsheet(sheetId, email, newRole);
          const activation = await fetch('/api/app-access', { method: 'PATCH', headers, body: JSON.stringify({ email, permissionId, sharedSheetId: sheetId }) });
          const activated = await activation.json() as { error?: { message: string } };
          if (!activation.ok) throw new Error(activated.error?.message || 'Sheet was shared, but the invitation could not be activated. Retry it.');
        }
      } else {
        let shareWarning = '';
        if (member?.shared_sheet_id && member.drive_permission_id) {
          try { await removeSpreadsheetShare(member.shared_sheet_id, member.drive_permission_id); }
          catch (error: any) { shareWarning = ` App access was revoked; remove Google Sheet sharing manually: ${error.message || 'Drive error'}`; }
        }
        const response = await fetch('/api/app-access', { method: 'DELETE', headers, body: JSON.stringify({ email }) });
        const data = await response.json() as { error?: { message: string } };
        if (!response.ok) throw new Error(data.error?.message || 'Could not revoke app access.');
        setAccessStatus(`App access revoked.${shareWarning}`);
      }
      await loadAccess();
      setAccessEmail('');
      if (newRole) setAccessStatus(shareSheet ? 'Invitation active and Google Sheet shared.' : 'App access active. This person can use a Sheet they can access.');
    } catch (error: any) { setAccessStatus(error.message || 'Could not update access.'); await loadAccess().catch(() => {}); }
    finally { setAccessBusy(false); }
  };

  const [status, setStatus] = useState<
    "idle" | "saving" | "success" | "error" | "creating" | "needsAuth"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [authorizing, setAuthorizing] = useState(false);

  useEffect(() => {
    const savedClasses = localStorage.getItem("quickStock_classesSheetId") || '';
    const savedThreshold =
      localStorage.getItem("quickStock_lowInventoryThreshold") || "5";
    setClassesSheetId(savedClasses);
    setLowInventoryThreshold(savedThreshold);
  }, [user?.uid, role, sharedSheetId]);

  const saveWorkspaceSheet = async (sheetId: string) => {
    if (!user || !role) throw new Error('Sign in with an approved Gmail first.');
    if (sharedSheetId) throw new Error('This account uses the Owner’s shared Sheet.');
    const token = await getFirebaseIdToken();
    const response = await fetch('/api/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Firebase-Token': token || '' }, body: JSON.stringify({ sheetId }) });
    const result = await response.json() as { error?: { message?: string } };
    if (!response.ok) throw new Error(result.error?.message || 'Could not save your workspace.');
    localStorage.setItem('quickStock_classesSheetId', sheetId);
    localStorage.setItem(`quickstock_sheet_${user.uid}`, sheetId);
    localStorage.setItem(`quickstock_active_sheet_${user.uid}`, sheetId);
    setClassesSheetId(sheetId);
    setAuditRules(readAuditRules(sheetId));
  };

  const handleAuthorizeGoogle = async () => {
    setAuthorizing(true);
    setErrorMsg("");
    try {
      await connectGoogleSheets();
      if (classesSheetId.trim()) await getSpreadsheetMetadata(spreadsheetIdFromInput(classesSheetId));
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to authorize Google Sheets.");
      setStatus("error");
    } finally {
      setAuthorizing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");

    try {
      const targetId = spreadsheetIdFromInput(classesSheetId);
      if (!targetId) throw new Error('Enter a Google Sheets link or spreadsheet ID.');
      if (hasGoogleAccess) await getSpreadsheetMetadata(targetId);

      await saveWorkspaceSheet(targetId);
      localStorage.setItem("quickStock_lowInventoryThreshold", lowInventoryThreshold);
      setStatus(hasGoogleAccess ? "success" : "needsAuth");

      if (hasGoogleAccess) setTimeout(() => setStatus("idle"), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message || "Failed to save Spreadsheet ID.");
    }
  };

  const handleCreateStarterSheets = async () => {
    setStatus("creating");
    setErrorMsg("");
    try {
      const { stockSheetId: newStockId, classesSheetId: newClassesId } =
        await createStarterSheets();
      // Formatting handled within the app after load. But we can trigger a first-time format here if needed.
      await formatStockColors(newStockId, 0, "Stock Room");
      await formatClassColors(newClassesId, 0, "Classes");
      await saveWorkspaceSheet(newClassesId);

      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message || "Failed to create starter sheets.");
    }
  };

  const updateAuditRule = (id: string, change: Partial<AuditRule>) => {
    setAuditRules(current => current.map(rule => rule.id === id ? { ...rule, ...change } : rule));
    setAuditRulesSaved(false);
  };

  const saveAuditRules = () => {
    const sheetId = localStorage.getItem('quickStock_classesSheetId') || '';
    writeAuditRules(sheetId, auditRules.filter(rule => rule.itemName.trim()));
    setAuditRulesSaved(true);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <div className="flex flex-col gap-4 rounded-[28px] border border-white/80 bg-gradient-to-br from-white/90 via-sky-50/80 to-cyan-100/50 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-sky-950/40 sm:p-8">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-sky-700 dark:text-sky-300"><SlidersHorizontal className="h-4 w-4" /> {t('Workspace preferences')}</div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('Settings')}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {t('Manage your inventory connection, appearance, and audit tracking.')}
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-2 text-xs font-bold sm:self-auto ${hasGoogleAccess ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}>
          <span className={`h-2 w-2 rounded-full ${hasGoogleAccess ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {hasGoogleAccess ? 'Google connected' : 'Google not connected'}
        </div>
      </div>

      <InstallAppCard />

      {role === 'owner' && <section className="rounded-[26px] border border-white/90 bg-white/85 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/85 sm:p-6" aria-label="App access">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-900 dark:text-white">{t('Gmail access')}</h2><p className="text-xs text-slate-500 dark:text-slate-400">Owner: sireykun8@gmail.com</p></div></div>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{t('Add an Editor or Viewer and optionally share the selected Google Sheet in the same flow. Google may ask you to approve Drive access.')}</p>
        <form onSubmit={event => { event.preventDefault(); changeAccess(accessEmail.trim().toLowerCase(), accessRole); }} className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto]"><input aria-label="Gmail to add" type="email" required pattern="[^\s@]+@gmail\.com" placeholder="person@gmail.com" value={accessEmail} onChange={event => setAccessEmail(event.target.value)} className="min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white" /><select aria-label="Permission" value={accessRole} onChange={event => setAccessRole(event.target.value as 'editor' | 'viewer')} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"><option value="viewer">{t('Viewer')}</option><option value="editor">{t('Editor')}</option></select><button type="submit" disabled={accessBusy} className="min-h-11 rounded-xl bg-sky-600 px-5 text-sm font-bold text-white disabled:opacity-50">{t('Add Gmail')}</button></div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"><input type="checkbox" checked={shareSelectedSheet} onChange={event => setShareSelectedSheet(event.target.checked)} className="h-4 w-4 accent-sky-600" />{t('Share my Google Sheet with this person. Leave unchecked for their own separate inventory.')}</label>
        </form>
        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">{accessMembers.map(member => <div key={member.email} className="flex flex-wrap items-center gap-2 py-3">
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{member.email}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(member.status)} · {t('Invited')} {member.invited_at ? new Date(member.invited_at).toLocaleDateString() : '—'} · {t('Last access')} {member.last_access_at ? new Date(member.last_access_at).toLocaleString() : t('never')}{member.status === 'revoked' && member.revoked_at ? ` · ${t('Revoked')} ${new Date(member.revoked_at).toLocaleDateString()}` : ''}</div></div>
          {member.status === 'pending' ? <button type="button" disabled={accessBusy} onClick={() => changeAccess(member.email, member.role, true)} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50">{t('Retry sharing')}</button> : member.status === 'revoked' ? <button type="button" disabled={accessBusy} onClick={() => changeAccess(member.email, member.role, Boolean(member.shared_sheet_id))} className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 disabled:opacity-50">{t('Invite again')}</button> : <select aria-label={`${t('Permission for')} ${member.email}`} value={member.role} disabled={accessBusy} onChange={event => changeAccess(member.email, event.target.value as 'editor' | 'viewer', Boolean(member.shared_sheet_id))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"><option value="viewer">{t('Viewer')}</option><option value="editor">{t('Editor')}</option></select>}
          {member.status !== 'revoked' && <button type="button" disabled={accessBusy} onClick={() => changeAccess(member.email)} className="rounded-lg px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">{t('Revoke')}</button>}
        </div>)}</div>
        {accessMembers.length === 0 && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">No additional Gmail accounts yet.</p>}
        {accessStatus && <p role="status" className="mt-3 text-sm text-sky-700 dark:text-sky-300">{accessStatus}</p>}
      </section>}

      <form
        onSubmit={handleSave}
        className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]"
      >
        <section className="order-2 rounded-[26px] border border-white/90 bg-white/85 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/85 sm:p-6 lg:order-none lg:col-start-2 lg:row-start-1" aria-label="Preferences">
        <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><SlidersHorizontal className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-900 dark:text-white">{t('Preferences')}</h2><p className="text-xs text-slate-500 dark:text-slate-400">Make the workspace yours</p></div></div>
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50"><label htmlFor="app-language" className="block text-sm font-bold text-slate-800 dark:text-slate-100">Language / ភាសា</label><p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Choose the app language.</p><select id="app-language" value={language} onChange={event => setLanguage(event.target.value as 'en' | 'km')} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"><option value="en">English</option><option value="km">ខ្មែរ (Khmer)</option></select></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {t('Application Theme')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('Choose a look for this device. Auto seasonal follows the calendar.')}
            </p>
          </div>
          <div role="group" aria-label={t('Application Theme')} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {themeOptions.map(option => <button
              key={option.id}
              type="button"
              aria-pressed={theme === option.id}
              onClick={() => setTheme(option.id)}
              className={`theme-choice flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${theme === option.id ? 'theme-choice-selected border-sky-600 bg-sky-100 text-sky-950 dark:border-sky-300 dark:bg-sky-900/60 dark:text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-sky-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}
            ><option.icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{t(option.label)}</span></button>)}
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"><ShieldCheck className="h-4 w-4" /> Stock alerts</div>
          <label htmlFor="lowInventoryThreshold" className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('Low Inventory Threshold')}</label>
          <input id="lowInventoryThreshold" type="number" min="0" value={lowInventoryThreshold} onChange={(e) => setLowInventoryThreshold(e.target.value)} placeholder="e.g. 5" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Show a warning badge on items with quantity below or equal to this number.</p>
        </div>
        </section>

        <section className="order-1 rounded-[26px] border border-white/90 bg-white/85 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/85 sm:p-6 lg:order-none lg:col-start-1 lg:row-start-1" aria-label="Spreadsheet connection">
        <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"><Database className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-900 dark:text-white">{t('Inventory data')}</h2><p className="text-xs text-slate-500 dark:text-slate-400">Connect the spreadsheet behind Quick Stock</p></div></div>
        <div className="space-y-2">
          <label
            htmlFor="classesSheetId"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {t('Main Google Sheet')}
          </label>
          <input
            id="classesSheetId"
            type="text"
            value={classesSheetId}
            onChange={(e) => setClassesSheetId(e.target.value)}
            readOnly={Boolean(sharedSheetId)}
            placeholder="Paste a Google Sheets link or spreadsheet ID"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {sharedSheetId ? 'The Owner shares this Sheet with you. Your inventory is part of their team workspace.' : 'Paste your own Sheets link or ID. Your inventory stays separate from other Gmail accounts.'}
          </p>
        </div>

        <div className="mt-5 flex flex-col justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/30 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('Google Sheets access')}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              {hasGoogleAccess ? 'Connected through your Google sign-in. No second sign-in is needed.' : 'Connect a Google account with access to this Sheet to read and save live inventory.'}
            </p>
          </div>
          {hasGoogleAccess
            ? <span className="shrink-0 rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Connected</span>
            : <button type="button" onClick={handleAuthorizeGoogle} disabled={authorizing} className="shrink-0 min-h-11 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold disabled:opacity-50">{authorizing ? 'Connecting...' : t('Connect Google')}</button>}
        </div>
        {!hasGoogleAccess && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{t('If Google says “Access blocked: gen-lang-client” after Connect Google, your Gmail must be allowed in that Google OAuth project. App roles alone cannot grant Google Sheets consent.')}</p>}

        {!sharedSheetId && <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Starting a new inventory?</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Create a ready-to-use spreadsheet with starter tabs.</p></div><button type="button" onClick={handleCreateStarterSheets} disabled={status === 'creating'} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-200 px-4 text-sm font-bold text-sky-700 transition-colors hover:bg-sky-50 disabled:opacity-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/40">{status === 'creating' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" /> : <FilePlus2 className="h-4 w-4" />}Create starter sheets</button></div>}

        {status === "error" && (
          <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 rounded-lg flex gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {status === "success" && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg flex gap-3 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p>Settings saved successfully!</p>
          </div>
        )}

        {status === "needsAuth" && (
          <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-lg flex gap-3 text-sm" role="status">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>Sheet saved. Connect your Google account above to load and edit its live data.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={status === "saving" || Boolean(sharedSheetId)}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 font-bold text-white shadow-md shadow-sky-200/70 transition-all hover:from-sky-700 hover:to-cyan-600 disabled:opacity-50 dark:shadow-none"
        >
          {status === "saving" ? (
            <div className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Save className="w-5 h-5" />
          )}
          {t('Save settings')}
        </button>
        </section>
      </form>
      <section className="rounded-[26px] border border-white/90 bg-white/85 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/85 sm:p-6" aria-label="Audit tracking rules">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('Audit tracking')}</h2><p className="text-xs text-slate-500 dark:text-slate-400">Choose what to check for each item and model</p></div></div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose which item names and models need serial numbers, hostnames, or duplicate checks. A blank model matches every model of that item. These preferences are saved in this browser.</p>
        <div className="mt-4 grid gap-3">
          {auditRules.map(rule => <div key={rule.id} className="rounded-xl border border-slate-200 bg-sky-50/40 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Item name
                <input aria-label="Item name to audit" value={rule.itemName} onChange={event => updateAuditRule(rule.id, { itemName: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white" placeholder="e.g. AIO" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Model contains
                <input aria-label={`Model filter for ${rule.itemName || 'item'}`} value={rule.modelContains} onChange={event => updateAuditRule(rule.id, { modelContains: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white" placeholder="All models" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
              {(['requireSnid', 'requireHostname', 'checkDuplicate'] as const).map(field => <label key={field} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200"><input type="checkbox" aria-label={`${field === 'requireSnid' ? 'Require SNID' : field === 'requireHostname' ? 'Require hostname' : 'Check duplicates'} for ${rule.itemName || 'item'} ${rule.modelContains}`} checked={rule[field]} onChange={event => updateAuditRule(rule.id, { [field]: event.target.checked })} className="h-4 w-4 accent-sky-600" />{field === 'requireSnid' ? 'Require SNID' : field === 'requireHostname' ? 'Require hostname' : 'Check duplicates'}</label>)}
              <button type="button" aria-label={`Remove audit rule for ${rule.itemName || 'item'}`} onClick={() => { setAuditRules(current => current.filter(entry => entry.id !== rule.id)); setAuditRulesSaved(false); }} className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">Remove</button>
            </div>
          </div>)}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => { setAuditRules(current => [...current, { id: crypto.randomUUID(), itemName: '', modelContains: '', requireSnid: false, requireHostname: false, checkDuplicate: false }]); setAuditRulesSaved(false); }} className="rounded-xl border border-sky-200 px-4 py-2 text-sm font-bold text-sky-700 dark:border-sky-700 dark:text-sky-300">+ Add rule</button><button type="button" onClick={saveAuditRules} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700">Save audit rules</button>{auditRulesSaved && <span role="status" className="text-sm text-sky-700 dark:text-sky-300">Saved</span>}</div>
      </section>
    </div>
  );
}

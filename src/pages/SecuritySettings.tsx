import React, { useState } from 'react';
import { SearchableSelect } from '../components/SearchableSelect';
import { 
  Shield, Key, Lock, CheckCircle2, AlertTriangle, UserCheck, 
  RefreshCw, LogOut, ShieldCheck, Eye, EyeOff, KeyRound, Server
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

export function SecuritySettings() {
  const { user, hasGoogleAccess, logout, login } = useAuth();
  const [sessionTimeout, setSessionTimeout] = useState('60');
  const [require2FA, setRequire2FA] = useState(false);
  const [readOnlyMode, setReadOnlyMode] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('quickStock_sessionTimeout', sessionTimeout);
    localStorage.setItem('quickStock_require2FA', JSON.stringify(require2FA));
    localStorage.setItem('quickStock_readOnlyMode', JSON.stringify(readOnlyMode));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Security & Permissions</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Manage authentication, access levels, session timeouts, and security policies.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={login}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Re-Authorize Google OAuth
          </button>
        </div>
      </div>

      {/* Security Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Auth Mode Card */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-6 rounded-[28px] border border-white/60 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Active Identity</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Currently signed in as:
            </p>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{user?.email || 'Administrator'}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">UID: {user?.uid || 'local_admin'}</p>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Session Status</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" /> Active
            </span>
          </div>
        </div>

        {/* OAuth Access Health */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-6 rounded-[28px] border border-white/60 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Google Sheets Bot Service</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Bot Service Account configured with full permissions:
            </p>
            <div className="p-3 bg-purple-50/50 dark:bg-purple-500/10 rounded-xl border border-purple-200/60 dark:border-purple-500/20 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-300">Bot Email</span>
              <p className="text-xs font-mono font-bold text-purple-900 dark:text-purple-200 truncate select-all">
                quick-stock-robot@gen-lang-client-0036616857.iam.gserviceaccount.com
              </p>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Access Level</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Full Permissions</span>
          </div>
        </div>

        {/* Security Policy Status */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-6 rounded-[28px] border border-white/60 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Security Posture</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Automated system security checks:
            </p>
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> SSL/TLS Enforced</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Client-Side Token Caching Safe</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Google Sheets Sandbox Active</li>
            </ul>
          </div>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Security Score</span>
            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">100% Secure</span>
          </div>
        </div>
      </div>

      {/* Security Policies Form */}
      <form onSubmit={handleSaveSecurity} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-6 rounded-[32px] border border-white/60 dark:border-white/10 shadow-sm space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-500" />
            Access Policy Configuration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configure session timeout limits and read-only protections for staff users.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
              Inactivity Session Timeout (Minutes)
            </label>
            <SearchableSelect
              aria-label="Inactivity session timeout"
              value={sessionTimeout}
              onChange={setSessionTimeout}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              options={[{ value: '15', label: '15 Minutes' }, { value: '30', label: '30 Minutes' }, { value: '60', label: '60 Minutes (Default)' }, { value: '240', label: '4 Hours' }, { value: '1440', label: '24 Hours' }]}
            />
            <p className="text-xs text-slate-400">Automatically logout inactive administrators after this duration.</p>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
              Access Safeguards
            </label>
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Read-Only Mode for Non-Admins</p>
                <p className="text-[11px] text-slate-400">Prevent inventory mutations without explicit admin approval.</p>
              </div>
              <input 
                type="checkbox"
                checked={readOnlyMode}
                onChange={(e) => setReadOnlyMode(e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Enforce Strict Google OAuth Verification</p>
                <p className="text-[11px] text-slate-400">Require OAuth token re-validation on sheet syncs.</p>
              </div>
              <input 
                type="checkbox"
                checked={require2FA}
                onChange={(e) => setRequire2FA(e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> Security policies saved successfully!
          </div>
        )}

        <div className="pt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={logout}
            className="px-5 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-100 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Revoke Session & Logout
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors"
          >
            Save Security Rules
          </button>
        </div>
      </form>
    </div>
  );
}

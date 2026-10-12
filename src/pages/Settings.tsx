import React, { useState, useEffect } from "react";
import {
  Save,
  AlertCircle,
  CheckCircle2,
  FilePlus2,
  Moon,
  Sun,
  KeyRound,
  Check,
  Download,
} from "lucide-react";
import {
  getSpreadsheetMetadata,
  createStarterSheets,
  formatClassColors,
  formatStockColors,
} from "../lib/sheets";
import { useTheme } from "../components/ThemeProvider";
import { authorizeGoogleSheets, getAccessToken } from "../lib/auth";
import { DEFAULT_SPREADSHEET_ID } from "../lib/config";
import { canPromptInstall, promptInstall } from "../lib/install";

const spreadsheetIdFromInput = (value: string) => value.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)?.[1] || value.trim();

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
    <section id="install-app" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-3xl shadow-sm">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><Download className="w-5 h-5 text-sky-600 dark:text-sky-400" /> Use Quick Stock as an app</h2>
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
  const [stockSheetId, setStockSheetId] = useState("");
  const [classesSheetId, setClassesSheetId] = useState("");
  const [lowInventoryThreshold, setLowInventoryThreshold] = useState("5");
  const { theme, toggleTheme } = useTheme();

  const [status, setStatus] = useState<
    "idle" | "saving" | "success" | "error" | "creating" | "needsAuth"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [authorizing, setAuthorizing] = useState(false);
  const [hasActiveGoogleToken, setHasActiveGoogleToken] = useState<boolean>(
    () => {
      const token = getAccessToken();
      return !!token && token !== "dummy_token_for_email_login";
    },
  );

  useEffect(() => {
    const savedClasses =
      localStorage.getItem("quickStock_classesSheetId") || DEFAULT_SPREADSHEET_ID;
    const savedThreshold =
      localStorage.getItem("quickStock_lowInventoryThreshold") || "5";
    setClassesSheetId(savedClasses);
    setLowInventoryThreshold(savedThreshold);
  }, []);

  const handleAuthorizeGoogle = async () => {
    setAuthorizing(true);
    setErrorMsg("");
    try {
      await authorizeGoogleSheets();
      setHasActiveGoogleToken(true);
      await getSpreadsheetMetadata(spreadsheetIdFromInput(classesSheetId));
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
      if (hasActiveGoogleToken) await getSpreadsheetMetadata(targetId);

      localStorage.setItem("quickStock_classesSheetId", targetId);
      localStorage.setItem("quickStock_lowInventoryThreshold", lowInventoryThreshold);
      setClassesSheetId(targetId);
      setStatus(hasActiveGoogleToken ? "success" : "needsAuth");

      if (hasActiveGoogleToken) setTimeout(() => setStatus("idle"), 3000);
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
      setClassesSheetId(newClassesId);

      localStorage.setItem("quickStock_classesSheetId", newClassesId);

      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message || "Failed to create starter sheets.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            Configure your Google Sheets connections.
          </p>
        </div>
        <button
          onClick={handleCreateStarterSheets}
          disabled={status === "creating"}
          className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
        >
          {status === "creating" ? (
            <div className="w-4 h-4 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <FilePlus2 className="w-4 h-4" />
          )}
          Create Starter Sheets
        </button>
      </div>

      <InstallAppCard />

      <form
        onSubmit={handleSave}
        className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6"
      >
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Application Theme
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Toggle between light and dark mode
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            {theme === "light" ? (
              <>
                <Moon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Dark Mode
                </span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Light Mode
                </span>
              </>
            )}
          </button>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="classesSheetId"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Main Google Sheet (Classes & Stock Room)
          </label>
          <input
            id="classesSheetId"
            type="text"
            value={classesSheetId}
            onChange={(e) => setClassesSheetId(e.target.value)}
            placeholder="Paste a Google Sheets link or spreadsheet ID"
            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-100"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This app reads the CLASS, stock room, Item Master, and template tabs from this spreadsheet. The tab link's gid is handled automatically.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-xl">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Google Sheets access</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              {hasActiveGoogleToken ? 'Google account connected. Save the sheet above to verify access.' : 'Connect a Google account with access to this Sheet to read and save live inventory.'}
            </p>
          </div>
          <button type="button" onClick={handleAuthorizeGoogle} disabled={authorizing} className="shrink-0 min-h-11 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold disabled:opacity-50">
            {authorizing ? 'Connecting...' : hasActiveGoogleToken ? 'Reconnect Google' : 'Connect Google'}
          </button>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="lowInventoryThreshold"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Low Inventory Threshold
          </label>
          <input
            id="lowInventoryThreshold"
            type="number"
            min="0"
            value={lowInventoryThreshold}
            onChange={(e) => setLowInventoryThreshold(e.target.value)}
            placeholder="e.g. 5"
            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-100"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Show a warning badge on items with quantity below or equal to this number.
          </p>
        </div>

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
          disabled={status === "saving"}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {status === "saving" ? (
            <div className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Save className="w-5 h-5" />
          )}
          Save Configuration
        </button>
      </form>
    </div>
  );
}

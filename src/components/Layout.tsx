import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Info, Settings, LogOut, Home, Box, Folder, Building2, Package, Layers, List, ChevronLeft, ChevronRight, ChevronDown, History, Shield, RotateCcw, ShieldAlert, Menu, X, ClipboardCheck, Plus } from 'lucide-react';
import { HSLogo, HSWordmark } from "./HSLogo";
import { BrandLoader } from './BrandLoader';
import { FluidSpinner } from './FluidSpinner';
import { useAuth } from './AuthProvider';
import { cn } from '../lib/utils';
import { CUSTOM_ROOM_PREFIX, isOfficeDepartment, roomLabel } from '../lib/rooms';
import { useLanguage } from './LanguageProvider';

export function Layout() {
  const { t } = useLanguage();
  const { user, role, accessLoading, accessError, loginError, loading, isLoggingIn, login, emailLogin, emailRegister, linkGoogle, logout, hasGoogleAccess } = useAuth();
  const [authMode, setAuthMode] = useState<'google' | 'email' | 'register'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) emailLogin(email, password);
  };
  
  const handleEmailRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) emailRegister(email, password);
  };
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLElement>(null);
  const [stockGroups, setStockGroups] = useState<string[]>(() => {
    const saved = localStorage.getItem('quickStock_stockGroups');
    return saved ? JSON.parse(saved) : [];
  });
  const [isStockMenuOpen, setIsStockMenuOpen] = useState(true);
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(true);
  const [isItemSetupMenuOpen, setIsItemSetupMenuOpen] = useState(true);
  const [isAdminToolsMenuOpen, setIsAdminToolsMenuOpen] = useState(true);
  const [customRooms, setCustomRooms] = useState<string[]>([]);
  const [officeDepartments, setOfficeDepartments] = useState<string[]>([]);

  useEffect(() => {
    if (!user || !role || !hasGoogleAccess) return;
    const sheetId = localStorage.getItem('quickStock_classesSheetId');
    if (sheetId) import('../lib/backups').then(({ captureDailyBackupOnOpen }) => captureDailyBackupOnOpen(sheetId)).catch(error => console.warn('Automatic backup failed:', error));
  }, [user?.uid, role, hasGoogleAccess]);

  useEffect(() => {
    if (!user) return;
    const sheetId = localStorage.getItem('quickStock_classesSheetId');
    if (!sheetId) return;
    const refreshRooms = () => import('../lib/sheets').then(({ getClasses }) => getClasses(sheetId, 'Classes')).then(rows => {
      const names = rows.map(row => row.title);
      setCustomRooms(names.filter(name => name.startsWith(CUSTOM_ROOM_PREFIX)));
      setOfficeDepartments(names.filter(isOfficeDepartment));
    }).catch(() => {});
    refreshRooms();
    window.addEventListener('quickstock:rooms-updated', refreshRooms);
    return () => window.removeEventListener('quickstock:rooms-updated', refreshRooms);
  }, [user?.uid, role]);

  useEffect(() => {
    const handleStockGroups = (e: any) => {
      setStockGroups(e.detail);
    };
    window.addEventListener('stockGroupsUpdated', handleStockGroups as EventListener);
    return () => window.removeEventListener('stockGroupsUpdated', handleStockGroups as EventListener);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    moreMenuRef.current?.querySelector<HTMLElement>('a')?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        moreButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMobileMenuOpen]);

  if (loading || (user && accessLoading)) {
    return (
      <div className="quickstock-shell min-h-screen flex flex-col items-center justify-center p-4 transition-colors relative overflow-hidden">
        <BrandLoader label="Loading Quick Stock" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="quickstock-shell min-h-screen flex flex-col items-center justify-center p-4 transition-colors relative overflow-hidden">
        {/* Glassmorphism Background Blobs */}
        <div className="quickstock-ambient absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-1/4 -left-[10%] w-[50%] h-[50%] rounded-full bg-sky-300/30 dark:bg-blue-900/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
          <div className="absolute bottom-1/4 -right-[10%] w-[50%] h-[50%] rounded-full bg-cyan-300/30 dark:bg-cyan-900/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
        </div>
        <div className="nova-panel bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-[32px] max-w-sm w-full text-center space-y-6 relative z-10">
          <div className="hs-login-brand"><HSWordmark /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Quick Stock</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">Sign in to manage IT inventory seamlessly connected to Google Sheets.</p>
          </div>
          
                    {authMode === 'google' ? (
            <div className="space-y-4">
              <button 
                onClick={login}
                disabled={isLoggingIn}
                className={cn(
                  "w-full flex items-center justify-center gap-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-sky-100 dark:border-white/10 font-bold py-3.5 px-4 rounded-2xl transition-all hover:shadow-md",
                  isLoggingIn ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] text-slate-800 dark:text-slate-200"
                )}
              >
                {isLoggingIn ? (
                  <FluidSpinner size="sm" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span>Sign in with Google</span>
              </button>
              {loginError && <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-left text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100">{loginError}</p>}
            </div>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Admin Login</h2>
              <input 
                type="text" 
                placeholder="Username or Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
              <input 
                type="password" 
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-sky-500/20"
              >
                {isLoggingIn ? "Signing In..." : "Sign In as Admin"}
              </button>
              <div className="flex justify-center text-sm mt-4">
                <button 
                  type="button"
                  onClick={() => setAuthMode('google')}
                  className="text-slate-500 hover:text-indigo-600 font-medium"
                >
                  Back to Google Sign In
                </button>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-4 text-left bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-3 rounded-lg leading-relaxed">
                Admin login opens the app. To read and edit the live Google Sheet, connect a Google account with access in Settings.
              </p>
            </form>
          )}

        </div>
      </div>
    );
  }

  if (!role) return <div className="quickstock-shell flex min-h-screen items-center justify-center p-4"><div className="nova-panel max-w-md rounded-3xl p-8 text-center"><Shield className="mx-auto h-10 w-10 text-sky-600" /><h1 className="mt-4 text-xl font-bold">Access required</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{accessError || `${user.email || 'This account'} is not on the Quick Stock access list. Ask the Owner to add your Gmail.`}</p><button type="button" onClick={logout} className="mt-5 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white">Sign out</button></div></div>;




  const menuItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Room', path: '/rooms', icon: Building2 },
    { name: 'ON Inventory', path: '/on-inventory', icon: ClipboardCheck },
    { name: 'Item Setup', path: '/item-setup', icon: Package },
    { name: 'Admin Tools', path: '/admin-tools', icon: Shield },
    { name: 'About App', path: '/about', icon: Info },
  ];
  const primaryMobileItems = menuItems.slice(0, 3);
  const secondaryMobileItems = menuItems.slice(3);
  const roomLinks = [
    { name: 'Stock', path: '/stock-room', icon: Box },
    { name: 'Classes', path: '/classes', icon: Folder },
    { name: 'Office', path: '/rooms/Office', icon: Building2 },
    ...officeDepartments.map(name => ({ name: `Office · ${roomLabel(name)}`, path: `/rooms/${encodeURIComponent(name)}`, icon: Folder })),
    ...customRooms.map(name => ({ name: roomLabel(name), path: `/rooms/${encodeURIComponent(name)}`, icon: Building2 })),
  ];
  const itemSetupLinks = [
    { name: 'Item Names', path: '/items', icon: Package },
    { name: 'Types', path: '/types', icon: Layers },
    { name: 'Default Items', path: '/defaults', icon: List },
    { name: 'Default Items for LAB', path: '/lab-defaults', icon: List },
  ];
  const adminToolLinks = [
    { name: 'Activity Logs', path: '/logs', icon: History },
    { name: 'Investigate', path: '/investigate', icon: ShieldAlert },
    { name: 'Restore Data', path: '/restore', icon: RotateCcw },
    { name: 'Security', path: '/security', icon: Shield },
  ];

  return (
    <div className="quickstock-shell quickstock-app-shell min-h-screen flex font-sans transition-colors duration-300 relative overflow-hidden">
      
      {/* Glassmorphism Background Blobs */}
      <div className="quickstock-ambient absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-sky-300/30 dark:bg-sky-900/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute top-[20%] -right-[10%] w-[35%] h-[35%] rounded-full bg-cyan-300/30 dark:bg-cyan-900/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute -bottom-[10%] left-[20%] w-[40%] h-[40%] rounded-full bg-blue-200/30 dark:bg-blue-900/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
      </div>
      
      {/* Sidebar - Desktop */}
      <aside className={cn(
        "quickstock-sidebar my-4 ml-4 rounded-[28px] bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 hidden md:flex flex-col relative z-10 transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "w-[84px]" : "w-[250px]"
      )}>
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-full shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 z-50 transition-colors hover:scale-110"
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className="flex-1 flex flex-col overflow-hidden w-full h-full">
          <div className={cn(
            "pt-10 pb-6 flex items-center text-[#1A1A1A] dark:text-white transition-all duration-300",
            isSidebarCollapsed ? "px-0 justify-center" : "px-6 flex-col items-start gap-2"
          )}>
            <div className="flex items-center gap-3 relative">
              {isSidebarCollapsed ? <HSLogo className="w-8 h-8 shrink-0" /> : <HSWordmark compact />}
              {isSidebarCollapsed && (
                <div title={hasGoogleAccess ? "Google Sheets connected" : "Google Sheets access needed"} className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                  <div className={cn("w-1.5 h-1.5 rounded-full", hasGoogleAccess ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500")}></div>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-1.5 bg-white/50 dark:bg-black/20 px-2.5 py-1 rounded-full border border-white/60 dark:border-white/5 shadow-sm">
                <div className={cn("w-2 h-2 rounded-full shrink-0", hasGoogleAccess ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500")}></div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">{hasGoogleAccess ? 'Sheets Connected' : 'Connect Google Sheets'}</span>
              </div>
            )}
          </div>

          <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path && location.search === '';
              if (item.name === 'Room') return <div key="Room">
                <div className={cn('flex items-center rounded-[20px]', location.pathname.startsWith('/rooms') || location.pathname.startsWith('/stock-room') || location.pathname.startsWith('/classes') ? 'quickstock-nav-active text-[#184064] dark:text-sky-100' : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-white/5')}>
                  <Link to="/rooms" title={isSidebarCollapsed ? t('Room') : undefined} className={cn('flex flex-1 items-center py-3.5 font-medium text-[15px]', isSidebarCollapsed ? 'justify-center px-0' : 'gap-4 pl-5')}><Building2 className="h-[22px] w-[22px] shrink-0" />{!isSidebarCollapsed && <span>{t('Room')}</span>}</Link>
                  {!isSidebarCollapsed && <button type="button" onClick={() => setIsRoomMenuOpen(open => !open)} aria-label={isRoomMenuOpen ? 'Collapse rooms' : 'Expand rooms'} aria-expanded={isRoomMenuOpen} className="rounded-xl p-3"><ChevronDown className={cn('h-4 w-4 transition-transform', isRoomMenuOpen ? '' : '-rotate-90')} /></button>}
                </div>
                {!isSidebarCollapsed && isRoomMenuOpen && <div className="ml-7 mt-1 space-y-1 border-l border-sky-200 pl-3 dark:border-slate-700">
                  {roomLinks.map(room => <Link key={room.path} to={room.path} className={cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm', location.pathname === room.path ? 'bg-sky-100 font-bold text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' : 'text-slate-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:bg-slate-800')}><room.icon className="h-4 w-4 shrink-0" /><span className="truncate">{t(room.name)}</span></Link>)}
                  <Link to="/rooms" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-sky-700 dark:text-sky-300"><Plus className="h-4 w-4" />Add room</Link>
                </div>}
              </div>;
              if (item.name === 'Item Setup') return <div key="Item Setup">
                <div className={cn('flex items-center rounded-[20px]', location.pathname === '/item-setup' || itemSetupLinks.some(link => location.pathname === link.path) ? 'quickstock-nav-active text-[#184064] dark:text-sky-100' : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-white/5')}>
                  <Link to="/item-setup" title={isSidebarCollapsed ? t('Item Setup') : undefined} className={cn('flex flex-1 items-center py-3.5 font-medium text-[15px]', isSidebarCollapsed ? 'justify-center px-0' : 'gap-4 pl-5')}><Package className="h-[22px] w-[22px] shrink-0" />{!isSidebarCollapsed && <span>{t('Item Setup')}</span>}</Link>
                  {!isSidebarCollapsed && <button type="button" onClick={() => setIsItemSetupMenuOpen(open => !open)} aria-label={isItemSetupMenuOpen ? 'Collapse item setup' : 'Expand item setup'} aria-expanded={isItemSetupMenuOpen} className="rounded-xl p-3"><ChevronDown className={cn('h-4 w-4 transition-transform', isItemSetupMenuOpen ? '' : '-rotate-90')} /></button>}
                </div>
                {!isSidebarCollapsed && isItemSetupMenuOpen && <div className="ml-7 mt-1 space-y-1 border-l border-sky-200 pl-3 dark:border-slate-700">
                  {itemSetupLinks.map(link => <Link key={link.path} to={link.path} className={cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm', location.pathname === link.path ? 'bg-sky-100 font-bold text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' : 'text-slate-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:bg-slate-800')}><link.icon className="h-4 w-4 shrink-0" /><span className="truncate">{t(link.name)}</span></Link>)}
                </div>}
              </div>;
              if (item.name === 'Admin Tools') return <div key="Admin Tools">
                <div className={cn('flex items-center rounded-[20px]', location.pathname === '/admin-tools' || adminToolLinks.some(link => location.pathname === link.path) ? 'quickstock-nav-active text-[#184064] dark:text-sky-100' : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-white/5')}>
                  <Link to="/admin-tools" title={isSidebarCollapsed ? t('Admin Tools') : undefined} className={cn('flex flex-1 items-center py-3.5 font-medium text-[15px]', isSidebarCollapsed ? 'justify-center px-0' : 'gap-4 pl-5')}><Shield className="h-[22px] w-[22px] shrink-0" />{!isSidebarCollapsed && <span>{t('Admin Tools')}</span>}</Link>
                  {!isSidebarCollapsed && <button type="button" onClick={() => setIsAdminToolsMenuOpen(open => !open)} aria-label={isAdminToolsMenuOpen ? 'Collapse admin tools' : 'Expand admin tools'} aria-expanded={isAdminToolsMenuOpen} className="rounded-xl p-3"><ChevronDown className={cn('h-4 w-4 transition-transform', isAdminToolsMenuOpen ? '' : '-rotate-90')} /></button>}
                </div>
                {!isSidebarCollapsed && isAdminToolsMenuOpen && <div className="ml-7 mt-1 space-y-1 border-l border-sky-200 pl-3 dark:border-slate-700">
                  {adminToolLinks.map(link => <Link key={link.path} to={link.path} className={cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm', location.pathname === link.path ? 'bg-sky-100 font-bold text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' : 'text-slate-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:bg-slate-800')}><link.icon className="h-4 w-4 shrink-0" /><span className="truncate">{t(link.name)}</span></Link>)}
                </div>}
              </div>;
              
              

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  title={isSidebarCollapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center rounded-[20px] transition-all font-medium text-[15px]",
                    isSidebarCollapsed ? "justify-center py-3.5 px-0" : "gap-4 px-5 py-3.5",
                    isActive 
                      ? "quickstock-nav-active text-[#184064] dark:text-sky-100 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-white/5"
                  )}
                >
                  <item.icon className="w-[22px] h-[22px] shrink-0" strokeWidth={isActive ? 2.5 : 1.75} />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">{t(item.name)}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 mt-auto">
            {!isSidebarCollapsed && (
              <div className="px-2 mb-3 text-center">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase">
                  Created by HOUT SIREYKUN
                </p>
              </div>
            )}
            <div className="bg-white/40 dark:bg-black/20 p-2 rounded-[24px] border border-white/40 dark:border-white/5 space-y-1">
              <Link
                to="/settings"
                title={isSidebarCollapsed ? "Settings" : undefined}
                className={cn(
                  "flex items-center rounded-[18px] transition-all font-medium text-[15px]",
                  isSidebarCollapsed ? "justify-center py-3 px-0" : "gap-4 px-4 py-3",
                  location.pathname === '/settings'
                    ? "bg-white dark:bg-slate-800 text-[#1A1A1A] dark:text-white shadow-sm" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-white/5"
                )}
              >
                <Settings className="w-5 h-5 shrink-0" strokeWidth={location.pathname === '/settings' ? 2.5 : 1.75} />
                {!isSidebarCollapsed && <span className="whitespace-nowrap">{t('Settings')}</span>}
              </Link>
              <button
                onClick={logout}
                title={isSidebarCollapsed ? "Sign Out" : undefined}
                className={cn(
                  "w-full flex items-center rounded-[18px] transition-all font-medium text-[15px] text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-white/5 hover:text-red-600 dark:hover:text-red-400",
                  isSidebarCollapsed ? "justify-center py-3 px-0" : "gap-4 px-4 py-3"
                )}
              >
                <LogOut className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                {!isSidebarCollapsed && <span className="whitespace-nowrap">{t('Sign Out')}</span>}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto relative z-0 flex flex-col">
        {/* Mobile Header */}
        <header className="quickstock-mobile-header md:hidden flex items-center justify-between p-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-b border-white/60 dark:border-white/10 m-4 rounded-[24px] shadow-sm relative z-10">
          <div className="flex items-center gap-2 font-bold text-lg text-[#1A1A1A] dark:text-white">
             <HSWordmark compact />
          </div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
             <Link to="/settings" aria-label="Settings" aria-current={location.pathname === '/settings' ? 'page' : undefined} className={cn("p-2 rounded-xl transition-colors", location.pathname === '/settings' ? "bg-[#1A1A1A] text-white" : "hover:bg-white/60")}><Settings className="w-5 h-5" /></Link>
             <button onClick={logout} aria-label="Sign out" className="p-2 rounded-xl hover:bg-white/60 hover:text-red-600 transition-colors"><LogOut className="w-5 h-5" /></button>
          </div>
        </header>

        {/* Removed Desktop Top Bar */}

        <div className="quickstock-main-content p-4 sm:px-6 md:px-8 pb-24 md:pb-12 max-w-[1500px] w-full mx-auto flex-1">
          {role === 'viewer' && <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100">Viewer access · Inventory changes are disabled for this account.</div>}
          <div className="quickstock-page-enter" key={location.pathname}>
            <Outlet />
          </div>
        </div>
      </main>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
          <nav ref={moreMenuRef} id="quickstock-more-nav" aria-label="More navigation" className="quickstock-more-menu absolute bottom-[82px] left-3 right-3 max-h-[65vh] overflow-y-auto rounded-[24px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 p-3 grid grid-cols-2 gap-2 shadow-xl" onClick={e => e.stopPropagation()}>
            {roomLinks.map(room => <Link key={room.path} to={room.path} onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800"><room.icon className="h-4 w-4 shrink-0" />{t(room.name)}</Link>)}
                <Link to="/rooms" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-3 text-xs font-semibold text-sky-700 dark:text-sky-300"><Plus className="h-4 w-4" />{t('Add room')}</Link>
            {secondaryMobileItems.map((item) => (
              <React.Fragment key={item.name}>
                <Link to={item.path} onClick={() => setIsMobileMenuOpen(false)} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-3 text-xs font-semibold", location.pathname === item.path ? "quickstock-nav-active text-sky-900 dark:text-sky-100" : "text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800")}>
                  <item.icon className="w-4 h-4 shrink-0" />{t(item.name)}
                </Link>
                {item.name === 'Item Setup' && itemSetupLinks.map(link => <Link key={link.path} to={link.path} onClick={() => setIsMobileMenuOpen(false)} className={cn('flex items-center gap-2.5 rounded-xl px-3 py-3 text-xs font-semibold', location.pathname === link.path ? 'quickstock-nav-active text-sky-900 dark:text-sky-100' : 'text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800')}><link.icon className="h-4 w-4 shrink-0" />{t(link.name)}</Link>)}
                {item.name === 'Admin Tools' && adminToolLinks.map(link => <Link key={link.path} to={link.path} onClick={() => setIsMobileMenuOpen(false)} className={cn('flex items-center gap-2.5 rounded-xl px-3 py-3 text-xs font-semibold', location.pathname === link.path ? 'quickstock-nav-active text-sky-900 dark:text-sky-100' : 'text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800')}><link.icon className="h-4 w-4 shrink-0" />{t(link.name)}</Link>)}
              </React.Fragment>
            ))}
            <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800"><Settings className="w-4 h-4" />{t('Settings')}</Link>
          </nav>
        </div>
      )}
      {/* Mobile Bottom Navigation */}
      <nav aria-label="Main navigation" className="quickstock-bottom-nav md:hidden fixed bottom-0 left-0 right-0 bg-white/85 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-white/10 px-2 flex items-start justify-around z-40">
        {primaryMobileItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.name}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex flex-col items-center gap-1 py-3 px-1 rounded-xl transition-all min-w-0 flex-1",
                isActive ? "text-sky-700 dark:text-sky-200" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.75} />
              <span className="text-[10px] font-semibold text-center leading-tight whitespace-normal max-w-full">{t(item.name === 'ON Inventory' && t('ON Inventory') === 'ON Inventory' ? 'ON Inv.' : item.name === 'Item Names' && t('Item Names') === 'Item Names' ? 'Items' : item.name)}</span>
            </Link>
          );
        })}
        <button ref={moreButtonRef} type="button" onClick={() => setIsMobileMenuOpen(open => !open)} aria-expanded={isMobileMenuOpen} aria-label={isMobileMenuOpen ? "Close more navigation" : "More navigation"} className={cn("flex flex-col items-center gap-1 py-3 px-1 rounded-xl transition-all min-w-0 flex-1", isMobileMenuOpen || secondaryMobileItems.some(item => location.pathname === item.path) || itemSetupLinks.some(item => location.pathname === item.path) || adminToolLinks.some(item => location.pathname === item.path) || location.pathname === '/settings' ? "text-sky-700 dark:text-sky-200" : "text-slate-500 dark:text-slate-400")}>
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          <span className="text-[10px] font-semibold">{t('More')}</span>
        </button>
      </nav>
    </div>
  );
}

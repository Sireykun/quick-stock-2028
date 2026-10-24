import { Link } from 'react-router-dom';
import { History, RotateCcw, Shield, ShieldAlert, FileUp, QrCode } from 'lucide-react';

const tools = [
  { title: 'Activity Logs', description: 'Review inventory changes and recent actions.', path: '/logs', icon: History },
  { title: 'Investigate', description: 'Find missing details, duplicate IDs, and audit issues.', path: '/investigate', icon: ShieldAlert },
  { title: 'Restore Data', description: 'Review backups and recover saved data.', path: '/restore', icon: RotateCcw },
  { title: 'Security', description: 'Manage security settings and access.', path: '/security', icon: Shield },
  { title: 'Import CSV', description: 'Validate rows and write them to Google Sheets in one batch.', path: '/import', icon: FileUp },
  { title: 'Asset QR labels', description: 'Print labels that open an asset directly.', path: '/labels', icon: QrCode },
];

export function AdminTools() {
  return <div className="inventory-page space-y-6">
    <div><h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Tools</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Audit activity, investigate assets, restore data, and manage security.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      {tools.map(tool => <Link key={tool.path} to={tool.path} className="nova-panel flex items-start gap-4 rounded-2xl p-5 text-slate-800 hover:border-sky-300 dark:text-white dark:hover:border-sky-700"><tool.icon className="mt-0.5 h-6 w-6 shrink-0 text-sky-600 dark:text-sky-300" /><div><h2 className="font-bold">{tool.title}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tool.description}</p></div></Link>)}
    </div>
  </div>;
}

import { Link } from 'react-router-dom';
import { Layers, List, Package } from 'lucide-react';

const sections = [
  { title: 'Item Names', description: 'Manage the item names used in inventory.', path: '/items', icon: Package },
  { title: 'Types', description: 'Manage item types and models.', path: '/types', icon: Layers },
  { title: 'Default Items', description: 'Choose the items for new classes.', path: '/defaults', icon: List },
  { title: 'Default Items for LAB', description: 'Choose the items for new labs.', path: '/lab-defaults', icon: List },
];

export function ItemSetup() {
  return <div className="inventory-page space-y-6">
    <div><h1 className="text-3xl font-bold text-slate-900 dark:text-white">Item Setup</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage item names, types, and default lists.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      {sections.map(section => <Link key={section.path} to={section.path} className="nova-panel flex items-start gap-4 rounded-2xl p-5 text-slate-800 hover:border-sky-300 dark:text-white dark:hover:border-sky-700"><section.icon className="mt-0.5 h-6 w-6 shrink-0 text-sky-600 dark:text-sky-300" /><div><h2 className="font-bold">{section.title}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{section.description}</p></div></Link>)}
    </div>
  </div>;
}

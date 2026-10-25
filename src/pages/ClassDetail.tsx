import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { InventoryList } from '../components/InventoryList';
import { ArrowLeft } from 'lucide-react';

export function ClassDetail() {
  const { className } = useParams();
  const sheetId = localStorage.getItem('quickStock_classesSheetId') || '';
  const decodedClassName = className ? decodeURIComponent(className) : '';

  return (
    <div className="class-detail-page fixed-workspace">
      <Link 
        to="/classes" 
        className="inline-flex items-center gap-2 text-[13px] font-bold text-slate-500 dark:text-slate-400 hover:text-[#1A1A1A] dark:hover:text-white transition-all uppercase tracking-widest bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-800/80 px-4 py-2.5 rounded-xl backdrop-blur-md border border-white/60 dark:border-white/10 w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Classes
      </Link>
      <InventoryList tabName="Classes" 
        sheetId={sheetId}
        className={decodedClassName}
        title={decodedClassName}
        subtitle="Manage inventory for"
        type="class"
      />
    </div>
  );
}

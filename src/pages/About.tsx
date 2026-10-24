import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Box, Folder, Package, Layers, List, QrCode, Home, Building2, ClipboardCheck, History, ShieldCheck, FileDown } from 'lucide-react';
import { useLanguage } from '../components/LanguageProvider';

export function About() {
  const { language } = useLanguage();
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Link 
          to="/"
          className="p-2.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{language === 'km' ? 'អំពីកម្មវិធី' : 'About Quick Stock'}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">{language === 'km' ? 'ស្វែងយល់ពីការគ្រប់គ្រងស្តុក និងការត្រួតពិនិត្យ។' : 'Your guide to rooms, stock, and asset checks.'}</p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden p-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{language === 'km' ? 'មុខងារសំខាន់ៗ' : 'What you can do'}</h2>
          <div className="space-y-6">
            <FeatureItem 
              icon={Home} 
              title={language === 'km' ? 'ទំព័រដើម' : 'Home overview'}
              description={language === 'km' ? 'មើលចំនួនទំនិញក្នុងស្តុក ថ្នាក់រៀន ការិយាល័យ និងបន្ទប់ផ្សេងទៀត។' : 'See asset totals and verification progress across stock, classes, Office, and other rooms.'}
            />
            <FeatureItem 
              icon={Box} 
              title={language === 'km' ? 'បន្ទប់ស្តុក' : 'Stock rooms'}
              description={language === 'km' ? 'មើល និងកែប្រែទំនិញក្នុងទីតាំងស្តុក។' : 'Manage items in storage and move them to a place where they are used.'}
            />
            <FeatureItem 
              icon={Folder} 
              title={language === 'km' ? 'ថ្នាក់រៀន' : 'Classes'}
              description={language === 'km' ? 'គ្រប់គ្រងទំនិញដែលប្រើនៅក្នុងថ្នាក់រៀន។' : 'Review and update equipment deployed in classrooms and labs.'}
            />
            <FeatureItem icon={Building2} title={language === 'km' ? 'ការិយាល័យ និងបន្ទប់' : 'Office and custom rooms'} description={language === 'km' ? 'រៀបចំទំនិញតាមផ្នែកការិយាល័យ ឬបន្ទប់ដែលអ្នកបន្ថែម។' : 'Organize assets by Office department or create another room for any location.'} />
            <FeatureItem icon={ClipboardCheck} title={language === 'km' ? 'ការត្រួតពិនិត្យស្តុក' : 'Inventory checks'} description={language === 'km' ? 'កត់ត្រាការត្រួតពិនិត្យទំនិញ និងមើលវឌ្ឍនភាព។' : 'Check assets in place, record their status, and follow verification progress.'} />
            <FeatureItem 
              icon={Package} 
              title={language === 'km' ? 'ឈ្មោះទំនិញ' : 'Item names'}
              description={language === 'km' ? 'កំណត់ឈ្មោះទំនិញស្តង់ដារ សម្រាប់ជ្រើសរើសនៅពេលបញ្ចូលទិន្នន័យ។' : 'Keep a shared list of item names for consistent inventory entry.'}
            />
            <FeatureItem 
              icon={Layers} 
              title={language === 'km' ? 'ប្រភេទ និងស្លាក' : 'Types and categories'}
              description={language === 'km' ? 'កំណត់ប្រភេទ ម៉ូដែល និងក្រុមទំនិញ។' : 'Define item types, models, and categories for clearer filtering.'}
            />
            <FeatureItem 
              icon={List} 
              title={language === 'km' ? 'ទំនិញលំនាំដើម' : 'Default items'}
              description={language === 'km' ? 'បង្កើតបញ្ជីទំនិញស្តង់ដារសម្រាប់ថ្នាក់រៀន និងបន្ទប់ពិសោធន៍។' : 'Define the expected items for classes and labs, then spot missing defaults.'}
            />
            <FeatureItem 
              icon={QrCode} 
              title={language === 'km' ? 'ស្កេនបាកូដ' : 'Barcode scanning'}
              description={language === 'km' ? 'ប្រើកាមេរ៉ាដើម្បីបញ្ចូលលេខសម្គាល់ទំនិញ។' : 'Use your camera to capture identifiers while editing inventory.'}
            />
            <FeatureItem icon={ShieldCheck} title={language === 'km' ? 'ស៊ើបអង្កេតទំនិញ' : 'Investigation and audit'} description={language === 'km' ? 'រកលេខសម្គាល់ស្ទួន និងព័ត៌មានដែលបាត់។' : 'Find duplicate identifiers and missing details, then export an audit report.'} />
            <FeatureItem icon={History} title={language === 'km' ? 'កំណត់ហេតុសកម្មភាព' : 'Activity logs'} description={language === 'km' ? 'មើលប្រវត្តិការផ្លាស់ប្តូរ និងគណនី Google ដែលធ្វើការកែប្រែ។' : 'Review recorded changes with the Google account that made them.'} />
            <FeatureItem icon={FileDown} title={language === 'km' ? 'របាយការណ៍' : 'Reports'} description={language === 'km' ? 'នាំចេញរបាយការណ៍សម្រាប់ការត្រួតពិនិត្យទំនិញ។' : 'Export inventory and audit reports for physical checks.'} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden p-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{language === 'km' ? 'របៀបចាប់ផ្តើម' : 'Getting started'}</h2>
          <ol className="list-decimal list-inside space-y-4 text-slate-700 dark:text-slate-300">
            {language === 'km' ? <>
              <li>ភ្ជាប់គណនី Google និងបញ្ចូលតំណ Google Sheet ក្នុងការកំណត់។</li>
              <li>បង្កើតឈ្មោះទំនិញ ប្រភេទ និងទំនិញលំនាំដើម។</li>
              <li>ជ្រើសរើសបន្ទប់ស្តុក ថ្នាក់រៀន ឬការិយាល័យ រួចបញ្ចូលទំនិញ។</li>
              <li>ប្រើការត្រួតពិនិត្យ និងរបាយការណ៍ ដើម្បីពិនិត្យទិន្នន័យ។</li>
            </> : <>
              <li>Connect a Google account and your spreadsheet in Settings.</li>
              <li>Set up item names, types, and optional default items.</li>
              <li>Choose Stock, Classes, Office, or another room and add assets.</li>
              <li>Use inventory checks and reports to verify what is there.</li>
            </>}
          </ol>
        </div>
      </div>

      <div className="mt-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
        Created by Sireykun Hout
      </div>
    </div>
  );
}

function FeatureItem({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-slate-600 dark:text-slate-400 mt-1">{description}</p>
      </div>
    </div>
  );
}

import React, { useEffect } from 'react';
import { ShieldCheck, Calendar } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { systemService } from '../../services/api';

export const Navbar: React.FC = () => {
  const { health, setHealth, asOfDate, setAsOfDate } = useAppStore();

  useEffect(() => {
    systemService.getHealth().then(setHealth).catch(console.error);
  }, [setHealth]);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-navy-900 text-white shadow-sm font-bold text-lg tracking-wider">
          V
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg text-navy-950 tracking-tight">VERITAS AI</span>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-navy-100 text-navy-800 rounded">MVP 0.1</span>
          </div>
          <p className="text-xs text-slate-500 font-medium">Evidence-First Document Intelligence</p>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        {/* As-Of Temporal Date Control */}
        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-600 font-medium">As-of Date:</span>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="bg-transparent border-none text-navy-900 font-semibold focus:outline-none cursor-pointer"
          />
        </div>

        {/* Backend & Vector DB Status */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${health?.database === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-slate-600 font-medium">DB:</span>
            <span className="font-semibold text-slate-800">{health?.database || 'Checking...'}</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${health?.vector_store === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-slate-600 font-medium">Qdrant:</span>
            <span className="font-semibold text-slate-800">{health?.vector_store || 'Local'}</span>
          </div>
        </div>

        <div className="pl-2 border-l border-slate-200 flex items-center space-x-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-medium border border-emerald-100">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Strict Evidence Mode</span>
        </div>
      </div>
    </header>
  );
};

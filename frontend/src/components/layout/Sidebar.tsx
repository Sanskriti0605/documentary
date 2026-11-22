import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  MessageSquareQuote,
  AlertTriangle,
  GitBranch,
  FileSearch,
  Scale
} from 'lucide-react';

const navigationItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Document Library', path: '/documents', icon: FileText },
  { name: 'Evidence Chat', path: '/chat', icon: MessageSquareQuote },
  { name: 'Contradiction Centre', path: '/contradictions', icon: AlertTriangle },
  { name: 'Amendment Explorer', path: '/amendments', icon: GitBranch },
  { name: 'PDF Evidence Viewer', path: '/viewer', icon: FileSearch },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)] border-r border-slate-800">
      <div className="p-4 space-y-6">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Intelligence Workspace
        </div>
        <nav className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="bg-slate-800/80 rounded-lg p-3 text-xs border border-slate-700/60">
          <div className="flex items-center space-x-2 text-blue-400 font-semibold mb-1">
            <Scale className="w-3.5 h-3.5" />
            <span>Verification Rule</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            <strong className="text-slate-200">NO EVIDENCE = NO ANSWER.</strong> All facts strictly resolved to source citations.
          </p>
        </div>

        <div className="text-[11px] text-slate-400 px-1 text-center">
          VERITAS AI &copy; 2026 &middot; Stage 1 Foundation
        </div>
      </div>
    </aside>
  );
};

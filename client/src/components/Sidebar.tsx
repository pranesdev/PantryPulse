import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  Home,
  MonitorCog,
  Package2,
  Settings,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useRealtimeStatus } from '../lib/realtimeContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/shelves', label: 'Shelves', icon: Boxes },
  { to: '/inventory', label: 'Inventory', icon: Package2 },
  { to: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/devices', label: 'Devices', icon: MonitorCog },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar = ({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) => (
  <SidebarContents mobileOpen={mobileOpen} onClose={onClose} />
);

const SidebarContents = ({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) => {
  const connected = useRealtimeStatus();
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', '24h', 'all'],
    queryFn: () => api.getDashboard({ range: '24h' }),
  });

  return (
  <>
    <div
      className={`fixed inset-0 z-30 bg-slate-950/80 transition-opacity lg:hidden ${mobileOpen ? 'visible opacity-100 backdrop-blur-sm' : 'invisible pointer-events-none opacity-0'}`}
      onClick={onClose}
      aria-hidden="true"
    />

    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-slate-950/95 p-5 transition-transform duration-200 lg:static lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="mb-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/pantrypulse-symbol.svg" alt="" aria-hidden="true" className="h-10 w-10 rounded-lg" />
          <div>
            <div className="text-xl font-bold text-white">PantryPulse</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Storage OS</div>
          </div>
        </div>
        <button className="rounded-lg border border-slate-700 p-2 text-slate-300 lg:hidden" onClick={onClose} aria-label="Close navigation">
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 shadow-[inset_0_1px_0_rgba(16,185,129,0.15)]'
                  : 'border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900/70 hover:text-white'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between text-sm text-slate-300">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {connected ? 'Realtime connected' : 'Polling fallback'}
          </div>
          <span className="text-xs text-slate-400">{dashboard?.demoMode ? 'DEMO' : 'LIVE'}</span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <Activity className="h-3.5 w-3.5 text-emerald-300" />
          {dashboard ? `${dashboard.metrics.onlineDevices} of ${dashboard.metrics.deviceCount} devices online` : 'Device status unavailable'}
        </div>
      </div>
    </aside>
  </>
  );
};

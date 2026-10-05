import { useState, type FormEvent } from 'react';
import { Bell, Menu, Search } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { api } from '../lib/api';
import { useRealtimeStatus } from '../lib/realtimeContext';

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Overview / Live monitoring' },
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview / Live monitoring' },
  '/shelves': { title: 'Shelves', subtitle: 'Cold storage fleet' },
  '/inventory': { title: 'Inventory', subtitle: 'Track every food batch' },
  '/alerts': { title: 'Alerts', subtitle: 'Operations issues' },
  '/reports': { title: 'Reports', subtitle: 'Performance analytics' },
  '/devices': { title: 'Devices', subtitle: 'Sensor health' },
  '/settings': { title: 'Settings', subtitle: 'System configuration' },
};

export const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const connected = useRealtimeStatus();
  const meta = location.pathname.startsWith('/shelves/')
    ? { title: 'Shelf details', subtitle: location.pathname.split('/').at(-1) ?? 'Storage unit' }
    : pageMeta[location.pathname] ?? { title: 'PantryPulse', subtitle: 'Operations overview' };
  const { data: alerts } = useQuery({ queryKey: ['alerts', 'unread'], queryFn: () => api.getAlerts({ unread: true }) });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (query) navigate(`/inventory?search=${encodeURIComponent(query)}`);
  }

  return (
    <div className="min-h-screen bg-[#020817] text-slate-100">
      <div className="mx-auto w-full max-w-[1700px]">
        <div className="flex min-h-screen">
          <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-6 xl:px-8">
                <div className="flex items-center gap-3">
                  <button
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 lg:hidden"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open navigation"
                  >
                    <Menu className="h-5 w-5" />
                  </button>

                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-emerald-300">Operations</div>
                    <h1 className="mt-1 truncate text-2xl font-semibold text-white">{meta.title}</h1>
                    <p className="max-w-full truncate text-sm text-slate-400">{meta.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <form onSubmit={submitSearch} className="hidden w-[280px] items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 xl:flex">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      aria-label="Search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search inventory..."
                      className="w-full border-0 bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none"
                    />
                  </form>

                  <div className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-sm md:flex ${connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {connected ? 'Realtime connected' : 'Polling updates'}
                  </div>

                  <Link to="/alerts" aria-label="View alerts" className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-slate-500">
                    <Bell className="h-4 w-4" />
                    {!!alerts?.length && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-950">{alerts.length}</span>}
                  </Link>

                  <Link to="/settings" className="hidden rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 sm:inline-flex">System settings</Link>
                </div>
              </div>
            </header>

            <main className="px-4 py-5 md:px-6 xl:px-8">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

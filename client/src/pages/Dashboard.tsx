import { motion } from 'framer-motion';
import { Activity, AlertTriangle, Boxes, Droplets, Gauge, Package2, Thermometer } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, getApiErrorMessage } from '../lib/api';
import { EmptyState } from '../components/ui/EmptyState';
import { useRealtimeStatus } from '../lib/realtimeContext';

const timeOptions = [
  { label: '1H', value: '1h' },
  { label: '6H', value: '6h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
];
const chartTooltipStyle = { background: '#ffffff', border: '1px solid #d9e1da', borderRadius: '6px', color: '#1a2923' };

export const Dashboard = () => {
  const [range, setRange] = useState('7d');
  const [shelfId, setShelfId] = useState('all');
  const connected = useRealtimeStatus();
  const { data: dashboard, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', range, shelfId],
    queryFn: () => api.getDashboard({ range, shelfId }),
  });
  const { data: allShelves } = useQuery({ queryKey: ['shelves'], queryFn: api.getShelves });
  const chartData = (dashboard?.telemetry ?? []).map((point) => ({
    time: ['1h', '6h', '24h'].includes(range)
      ? new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date(point.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    weight: point.weight,
    temp: point.temperature,
    humidity: point.humidity,
    voc: point.voc,
  }));
  const metricValue = (value: number | null, suffix = '') => value === null ? 'No reading' : `${value.toFixed(1)}${suffix}`;

  const statCards = [
    { label: 'Total Weight', value: dashboard ? `${dashboard.metrics.totalWeight.toFixed(1)} kg` : '—', delta: `${dashboard?.metrics.totalCapacity.toFixed(1) ?? '—'} kg capacity`, icon: Gauge },
    { label: 'Storage Utilization', value: dashboard?.metrics.utilization === null || dashboard?.metrics.utilization === undefined ? '—' : `${dashboard.metrics.utilization.toFixed(0)}%`, delta: `${dashboard?.shelves.length ?? 0} shelves`, icon: Boxes },
    { label: 'Temperature', value: metricValue(dashboard?.metrics.temperature ?? null, '°C'), delta: 'Current average', icon: Thermometer },
    { label: 'Humidity', value: metricValue(dashboard?.metrics.humidity ?? null, '%'), delta: 'Current average', icon: Droplets },
    { label: 'Active Alerts', value: String(dashboard?.metrics.activeAlerts ?? '—'), delta: 'Unresolved', icon: AlertTriangle },
    { label: 'Inventory Items', value: String(dashboard?.metrics.inventoryCount ?? '—'), delta: 'Tracked batches', icon: Package2 },
    { label: 'Expiring Soon', value: String(dashboard?.metrics.expiringSoon ?? '—'), delta: 'Next 7 days', icon: AlertTriangle },
    { label: 'Surplus Items', value: String(dashboard?.metrics.surplusItems ?? '—'), delta: 'Needs action', icon: Activity },
  ];

  if (isLoading) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />)}</div>;
  if (isError) return <EmptyState title="Dashboard data unavailable" description={getApiErrorMessage(error, 'The API request failed. Check the connection and retry.')} action={<button onClick={() => void refetch()} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950">Retry</button>} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-300 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Facility monitoring / All storage zones</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950 md:text-3xl">Storage overview</h2>
          <p className="mt-1 text-sm text-slate-500">Updated {dashboard ? new Date(dashboard.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} · {dashboard?.shelves.length ?? 0} monitored shelves</p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${dashboard?.demoMode ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-slate-300 bg-white text-slate-600'}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${dashboard?.demoMode ? 'bg-amber-400' : connected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          {dashboard?.demoMode ? 'DEMO MODE' : connected ? 'LIVE' : 'POLLING'}
        </div>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;

          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="border-b border-r border-slate-200 p-4 md:p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <Icon className={`h-6 w-6 md:h-7 md:w-7 ${card.label === 'Active Alerts' ? 'text-rose-700' : 'text-slate-400'}`} />
              </div>
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <div className="font-mono tabular-nums text-2xl font-medium text-slate-950">{card.value}</div>
                <div className="text-xs text-slate-500">{card.delta}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 md:p-5">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <h3 className="text-lg font-semibold text-slate-900">Telemetry trends</h3>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/50 p-1">
              {timeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setRange(option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${range === option.value ? 'bg-emerald-500/15 text-emerald-200' : 'text-slate-400'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <select aria-label="Filter telemetry by shelf" value={shelfId} onChange={(event) => setShelfId(event.target.value)} className="min-w-0 max-w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 outline-none">
              <option value="all">All Shelves</option>
              {allShelves?.map((shelf) => <option key={shelf.shelfId} value={shelf.shelfId}>{shelf.name}</option>)}
            </select>
          </div>
        </div>

        {chartData.length === 0 && (
          <p role="status" className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
            No telemetry readings in this time range. Try 7D or 30D to view older readings.
          </p>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-medium text-white">Weight</p>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">kg</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 5" stroke="#e1e7e1" />
                  <XAxis dataKey="time" stroke="#718078" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#718078" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="weight" stroke="#34d399" fill="url(#weightFill)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-medium text-white">Temperature</p>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">°C</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 5" stroke="#e1e7e1" />
                  <XAxis dataKey="time" stroke="#718078" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#718078" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="temp" stroke="#fbbf24" fill="url(#tempFill)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-medium text-white">Humidity</p>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">%</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="humidityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 5" stroke="#e1e7e1" />
                  <XAxis dataKey="time" stroke="#718078" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#718078" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="humidity" stroke="#38bdf8" fill="url(#humidityFill)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-medium text-white">VOC / Environmental Risk</p>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">AQI</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="vocFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f472b6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f472b6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 5" stroke="#e1e7e1" />
                  <XAxis dataKey="time" stroke="#718078" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#718078" tick={{ fontSize: 11 }} />
                  <Legend />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="voc" stroke="#f472b6" fill="url(#vocFill)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

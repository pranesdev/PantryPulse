import { motion } from 'framer-motion';
import { Download, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, getApiErrorMessage } from '../lib/api';

const initialTo = new Date().toISOString().slice(0, 10);
const initialFrom = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const chartStyle = { background: '#ffffff', border: '1px solid #d9e1da', borderRadius: '6px', color: '#1a2923' };

export const ReportsPage = () => {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const { data: report, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports', from, to],
    queryFn: () => api.getReports({ from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59`).toISOString() }),
    enabled: Boolean(from && to),
  });

  async function exportCsv() {
    setExportError('');
    setExporting(true);
    try {
      const blob = await api.exportReports({ from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59`).toISOString() });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'pantrypulse-telemetry.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setExportError(getApiErrorMessage(cause, 'The CSV export could not be generated.'));
    } finally {
      setExporting(false);
    }
  }

  const inventoryMix = Object.entries(report?.inventoryMix ?? {}).map(([name, value]) => ({ name: name.replaceAll('_', ' '), value }));
  const alertTrend = Object.entries((report?.alerts ?? []).reduce<Record<string, number>>((counts, alert) => {
    const date = new Date(alert.timestamp).toISOString().slice(0, 10);
    counts[date] = (counts[date] ?? 0) + 1;
    return counts;
  }, {})).map(([date, count]) => ({ date, count }));
  const summary = report?.summary;

  if (isLoading) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />)}</div>;
  if (isError) return <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-100">{getApiErrorMessage(error, 'Could not load report data.')} <button onClick={() => void refetch()} className="ml-2 underline">Retry</button></div>;

  const cards = [
    { label: 'Recorded readings', value: summary?.telemetryPoints ?? 0, note: 'Within selected period', tone: 'text-emerald-800' },
    { label: 'Expiring batches', value: summary?.expiringItems ?? 0, note: 'Next 7 days', tone: 'text-amber-800' },
    { label: 'Expired batches', value: summary?.expiredItems ?? 0, note: 'Current inventory', tone: 'text-rose-800' },
    { label: 'Surplus detected', value: summary?.surplusDetected ?? 0, note: `${summary?.surplusDonated ?? 0} donated`, tone: 'text-sky-800' },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Reports</p><h2 className="mt-2 text-3xl font-semibold text-white">Operational data</h2><p className="mt-1 text-sm text-slate-400">Telemetry, inventory status, alerts, and surplus records.</p></div>
        <div className="flex flex-wrap items-end gap-3"><label className="text-xs text-slate-400">From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-400">To<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label><button disabled={exporting} onClick={() => void exportCsv()} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 disabled:opacity-50"><Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export CSV'}</button></div>
      </section>

      {exportError && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{exportError}</p>}

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white xl:grid-cols-4">{cards.map((card, index) => <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="border-b border-r border-slate-200 p-4 md:p-5"><div className="mb-3 flex items-center justify-between gap-2"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</span><TrendingUp className="h-4 w-4 text-slate-400" /></div><div className="font-mono tabular-nums text-2xl font-medium text-slate-950">{card.value}</div><div className={`mt-2 text-xs ${card.tone}`}>{card.note}</div></motion.div>)}</div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><h3 className="text-lg font-semibold text-white">Weight and environmental trends</h3><p className="mb-4 text-sm text-slate-400">Daily average from stored telemetry</p><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={report?.daily ?? []}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="date" stroke="#94a3b8" /><YAxis yAxisId="left" stroke="#94a3b8" /><YAxis yAxisId="right" orientation="right" stroke="#fbbf24" /><Tooltip contentStyle={chartStyle} /><Legend /><Line yAxisId="left" type="monotone" dataKey="averageWeight" name="Weight kg" stroke="#34d399" strokeWidth={2} dot={false} /><Line yAxisId="right" type="monotone" dataKey="averageTemperature" name="Temp °C" stroke="#fbbf24" strokeWidth={2} dot={false} /><Line yAxisId="right" type="monotone" dataKey="averageHumidity" name="Humidity %" stroke="#38bdf8" strokeWidth={2} dot={false} /><Line yAxisId="right" type="monotone" dataKey="averageVoc" name="VOC" stroke="#fb7185" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><h3 className="text-lg font-semibold text-white">Current inventory status</h3><p className="mb-4 text-sm text-slate-400">Batch counts by saved status and expiry date</p><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={inventoryMix}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="name" stroke="#94a3b8" /><YAxis allowDecimals={false} stroke="#94a3b8" /><Tooltip contentStyle={chartStyle} /><Bar dataKey="value" name="Batches" fill="#34d399" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-semibold text-white">Shelf utilization</h3><p className="text-sm text-slate-400">Most recent recorded weight per shelf</p></div><span className="text-sm text-slate-400">{report?.shelfUtilization.length ?? 0} shelves</span></div><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={report?.shelfUtilization ?? []} layout="vertical" margin={{ left: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis type="number" domain={[0, 100]} stroke="#94a3b8" /><YAxis type="category" dataKey="name" stroke="#94a3b8" /><Tooltip contentStyle={chartStyle} formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Utilization']} /><Bar dataKey="utilization" name="Utilization" fill="#34d399" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div></section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><h3 className="text-lg font-semibold text-white">Alerts over time</h3><p className="mb-4 text-sm text-slate-400">Persisted alert creation timestamps</p><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={alertTrend}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="date" stroke="#94a3b8" /><YAxis allowDecimals={false} stroke="#94a3b8" /><Tooltip contentStyle={chartStyle} /><Bar dataKey="count" name="Alerts" fill="#fbbf24" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
      </div>
      {!report?.telemetry.length && <div className="rounded-xl border border-slate-800 p-4 text-sm text-slate-400">No telemetry was recorded in this date range. Inventory and alert totals are based on records currently stored.</div>}
    </div>
  );
};

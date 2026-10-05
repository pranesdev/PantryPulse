import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, Check, CircleDashed, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, getApiErrorMessage } from '../lib/api';
import { StatusBadge } from '../components/ui/StatusBadge';

const toneForSeverity: Record<string, 'critical' | 'warning' | 'info' | 'neutral'> = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
};

export const AlertsPage = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('ACTIVE');
  const [severity, setSeverity] = useState('ALL');
  const [feedback, setFeedback] = useState('');
  const { data: alerts, isLoading, isError, error, refetch } = useQuery({ queryKey: ['alerts', 'all'], queryFn: () => api.getAlerts() });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const resolve = useMutation({
    mutationFn: api.resolveAlert,
    onSuccess: () => { setFeedback('Alert resolved.'); invalidate(); },
    onError: (cause) => setFeedback(getApiErrorMessage(cause, 'The alert could not be resolved.')),
  });
  const markRead = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) => api.markAlertRead(id, read),
    onSuccess: (_alert, variables) => { setFeedback(variables.read ? 'Alert marked as read.' : 'Alert marked unread.'); invalidate(); },
    onError: (cause) => setFeedback(getApiErrorMessage(cause, 'The alert read state could not be updated.')),
  });
  const readAll = useMutation({
    mutationFn: api.markAllAlertsRead,
    onSuccess: invalidate,
    onError: (cause) => setFeedback(getApiErrorMessage(cause, 'Unread alerts could not be updated.')),
  });
  const activeAlerts = (alerts ?? []).filter((alert) => !alert.resolved);
  const shownAlerts = (alerts ?? []).filter((alert) => filter === 'ACTIVE' ? !alert.resolved : filter === 'RESOLVED' ? alert.resolved : true).filter((alert) => severity === 'ALL' || alert.severity === severity);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Alert center</p><h2 className="mt-2 text-3xl font-semibold text-white">Operations alerts</h2><p className="mt-1 text-sm text-slate-400">{activeAlerts.length} unresolved alerts · {alerts?.filter((alert) => !alert.read).length ?? 0} unread</p></div>
          <button disabled={readAll.isPending || !alerts?.some((alert) => !alert.read)} onClick={() => readAll.mutate()} className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-medium text-slate-200 disabled:opacity-50">Mark all as read</button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">{(['CRITICAL', 'WARNING', 'INFO'] as const).map((level) => <div key={level} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><div className="text-sm text-slate-400">{level}</div><div className="mt-2 text-2xl font-semibold text-white">{activeAlerts.filter((alert) => alert.severity === level).length}</div></div>)}</div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2" role="tablist" aria-label="Alert status">{[['ACTIVE', 'Active'], ['ALL', 'All'], ['RESOLVED', 'Resolved']].map(([value, label]) => <button key={value} role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-sm ${filter === value ? 'bg-emerald-500/15 text-emerald-200' : 'text-slate-400 hover:text-white'}`}>{label}</button>)}</div><select aria-label="Filter alert severity" value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="ALL">All severity</option><option value="CRITICAL">Critical</option><option value="WARNING">Warning</option><option value="INFO">Info</option></select></section>

      {feedback && <p role={resolve.isError || markRead.isError || readAll.isError ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${resolve.isError || markRead.isError || readAll.isError ? 'border-rose-500/30 text-rose-200' : 'border-slate-700 text-slate-200'}`}>{feedback}</p>}

      {isLoading && <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />)}</div>}
      {isError && <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-100">{getApiErrorMessage(error, 'Could not load alerts.')} <button onClick={() => void refetch()} className="ml-2 underline">Retry</button></div>}
      {!isLoading && !isError && shownAlerts.length === 0 && <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center"><Bell className="mx-auto h-6 w-6 text-slate-500" /><p className="mt-3 font-medium text-white">No alerts in this view</p><p className="mt-1 text-sm text-slate-400">New device and threshold alerts will appear here.</p></div>}

      <div className="space-y-3">{shownAlerts.map((alert) => <article key={alert.id} className={`rounded-2xl border bg-slate-900/60 p-5 ${alert.read ? 'border-slate-800' : 'border-slate-700'}`}><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex items-start gap-4"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${alert.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-200' : alert.severity === 'WARNING' ? 'bg-amber-500/10 text-amber-200' : 'bg-sky-500/10 text-sky-200'}`}>{alert.severity === 'CRITICAL' ? <ShieldAlert className="h-5 w-5" /> : alert.severity === 'WARNING' ? <AlertTriangle className="h-5 w-5" /> : <CircleDashed className="h-5 w-5" />}</div><div><div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge tone={toneForSeverity[alert.severity] ?? 'neutral'}>{alert.severity}</StatusBadge><StatusBadge tone={alert.resolved ? 'healthy' : 'neutral'}>{alert.resolved ? 'Resolved' : 'Open'}</StatusBadge>{!alert.read && <span className="text-xs text-emerald-200">Unread</span>}</div><h3 className="text-lg font-semibold text-white">{alert.type.replaceAll('_', ' ')}</h3><p className="mt-1 text-sm text-slate-300">{alert.description}</p><p className="mt-2 text-xs text-slate-400">{alert.shelf?.name ?? 'System'}{alert.device ? ` · ${alert.device.name} (${alert.device.deviceId})` : ''} · {new Date(alert.timestamp).toLocaleString()}</p></div></div><div className="flex flex-wrap items-center gap-2">{alert.shelf && <Link to={`/shelves/${encodeURIComponent(alert.shelf.shelfId)}`} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200">View shelf</Link>}<button onClick={() => markRead.mutate({ id: alert.id, read: !alert.read })} aria-label={alert.read ? 'Mark unread' : 'Mark read'} className="rounded-lg border border-slate-700 p-2 text-slate-300">{alert.read ? <Bell className="h-4 w-4" /> : <Check className="h-4 w-4" />}</button>{!alert.resolved && <button disabled={resolve.isPending} onClick={() => resolve.mutate(alert.id)} className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950">Resolve</button>}</div></div></article>)}</div>
    </div>
  );
};

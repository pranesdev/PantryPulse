import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, Droplets, Gauge, Package2, Pencil, Thermometer } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, getApiErrorMessage } from '../lib/api';
import { StatusBadge } from '../components/ui/StatusBadge';

export const ShelfDetailPage = () => {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const { data: shelf, isLoading, isError, error, refetch } = useQuery({ queryKey: ['shelf', id], queryFn: () => api.getShelf(id), enabled: Boolean(id) });
  const { data: alerts } = useQuery({ queryKey: ['alerts', 'shelf', id], queryFn: () => api.getAlerts() });
  const { data: devices } = useQuery({ queryKey: ['devices'], queryFn: api.getDevices });
  const updateShelf = useMutation({
    mutationFn: (payload: { name: string; maxCapacity: number; deviceId: string }) => api.updateShelf(id, payload),
    onSuccess: () => { setEditing(false); setFeedback('Shelf details saved.'); void queryClient.invalidateQueries({ queryKey: ['shelf', id] }); void queryClient.invalidateQueries({ queryKey: ['shelves'] }); },
    onError: (cause) => setFeedback(getApiErrorMessage(cause, 'Shelf details could not be saved.')),
  });
  const deleteShelf = useMutation({
    mutationFn: () => api.deleteShelf(id),
    onSuccess: () => { window.location.assign('/shelves'); },
    onError: (cause) => setFeedback(getApiErrorMessage(cause, 'This shelf could not be deleted.')),
  });

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateShelf.mutate({ name: String(form.get('name')), maxCapacity: Number(form.get('maxCapacity')), deviceId: String(form.get('deviceId')) });
  }

  if (isLoading) return <div className="space-y-4"><div className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />)}</div></div>;
  if (isError || !shelf) return <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-100">{getApiErrorMessage(error, 'Shelf not found.')} <button onClick={() => void refetch()} className="ml-2 underline">Retry</button> <Link to="/shelves" className="ml-2 underline">All shelves</Link></div>;

  const shelfAlerts = (alerts ?? []).filter((alert) => alert.shelfId === shelf.id || alert.shelf?.shelfId === shelf.shelfId);
  const chartData = [...shelf.telemetry].reverse().map((point) => ({ time: new Date(point.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), ...point }));
  const metricCards = [
    { label: 'Weight / capacity', value: shelf.currentWeight === null ? `— / ${shelf.maxCapacity} kg` : `${shelf.currentWeight.toFixed(1)} / ${shelf.maxCapacity} kg`, icon: Gauge },
    { label: 'Temperature', value: shelf.temperature === null ? 'No reading' : `${shelf.temperature.toFixed(1)}°C`, icon: Thermometer },
    { label: 'Humidity', value: shelf.humidity === null ? 'No reading' : `${shelf.humidity.toFixed(0)}%`, icon: Droplets },
    { label: 'Utilization', value: shelf.utilization === null ? 'No reading' : `${shelf.utilization.toFixed(0)}%`, icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex items-center gap-4"><Link to="/shelves" aria-label="Back to shelves" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 text-slate-300"><ArrowLeft className="h-4 w-4" /></Link><div><p className="text-xs uppercase tracking-[0.18em] text-emerald-300">{shelf.shelfId}</p><h2 className="mt-1 text-2xl font-semibold text-white">{shelf.name}</h2><p className="text-sm text-slate-400">Connected to {shelf.device.name} · {shelf.sensors.length} sensors</p></div></div><div className="flex items-center gap-2"><StatusBadge tone={shelf.status === 'ONLINE' ? 'online' : 'critical'}>{shelf.status}</StatusBadge><button onClick={() => setEditing(true)} aria-label="Edit shelf" className="rounded-lg border border-slate-700 p-2 text-slate-200"><Pencil className="h-4 w-4" /></button><button onClick={() => { if (window.confirm(`Delete ${shelf.name}? Shelves with sensors, inventory, or telemetry cannot be deleted.`)) deleteShelf.mutate(); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-rose-200">Delete</button></div></section>

      {feedback && <p role="status" className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-200">{feedback}</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{metricCards.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="mb-3 flex items-center justify-between text-sm text-slate-400"><span>{label}</span><Icon className="h-4 w-4" /></div><p className="text-xl font-semibold text-white">{value}</p></div>)}</div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-semibold text-white">Recorded telemetry</h3><p className="text-sm text-slate-400">Most recent {chartData.length} readings</p></div><span className="text-xs text-slate-500">Last reading {shelf.lastTelemetryAt ? new Date(shelf.lastTelemetryAt).toLocaleString() : 'not available'}</span></div>{chartData.length ? <div className="grid gap-5 xl:grid-cols-2">{[['Weight', 'weight', '#198866'], ['Temperature', 'temperature', '#c58816'], ['Humidity', 'humidity', '#377e89'], ['VOC', 'voc', '#b95357']].map(([label, key, color]) => <div key={key} className="h-56"><p className="mb-2 text-sm text-slate-600">{label}</p><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><CartesianGrid strokeDasharray="2 5" stroke="#e1e7e1" /><XAxis dataKey="time" stroke="#718078" tick={{ fontSize: 10 }} /><YAxis stroke="#718078" /><Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #d9e1da', borderRadius: '6px', color: '#1a2923' }} /><Area type="monotone" dataKey={key} stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} /></AreaChart></ResponsiveContainer></div>)}</div> : <div className="py-12 text-center text-sm text-slate-400">No telemetry recorded for this shelf yet.</div>}</section>

      <div className="grid gap-5 xl:grid-cols-2"><section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="mb-4 flex items-center gap-2"><Package2 className="h-4 w-4 text-sky-300" /><h3 className="font-semibold text-white">Stored batches</h3></div>{shelf.inventory.length ? <div className="divide-y divide-slate-800">{shelf.inventory.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="font-medium text-white">{item.food}</p><p className="text-xs text-slate-400">{item.batch} · {item.quantity} units · {item.weight} kg</p></div><div className="text-right text-xs text-slate-400"><div>{new Date(item.expiryDate).toLocaleDateString()}</div><div>{item.rfidTagId ?? 'No RFID tag'}</div></div></div>)}</div> : <p className="py-6 text-sm text-slate-400">No inventory is assigned to this shelf.</p>}</section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><h3 className="font-semibold text-white">Active shelf alerts</h3>{shelfAlerts.length ? <div className="mt-3 space-y-2">{shelfAlerts.map((alert) => <div key={alert.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center justify-between"><StatusBadge tone={alert.severity === 'CRITICAL' ? 'critical' : alert.severity === 'WARNING' ? 'warning' : 'info'}>{alert.severity}</StatusBadge><span className="text-xs text-slate-500">{new Date(alert.timestamp).toLocaleString()}</span></div><p className="mt-2 text-sm text-white">{alert.description}</p></div>)}</div> : <p className="mt-3 py-6 text-sm text-slate-400">No active alerts for this shelf.</p>}</section></div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><h3 className="mb-4 font-semibold text-white">Device and sensors</h3><div className="mb-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><p className="text-xs text-slate-400">Device</p><p className="mt-1 font-medium text-white">{shelf.device.name}</p><p className="text-xs text-slate-400">{shelf.device.deviceId}</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><p className="text-xs text-slate-400">Firmware</p><p className="mt-1 font-medium text-white">{shelf.device.firmware ?? 'Not reported'}</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><p className="text-xs text-slate-400">Last heartbeat</p><p className="mt-1 font-medium text-white">{shelf.device.lastSeen ? new Date(shelf.device.lastSeen).toLocaleString() : 'Never received'}</p></div></div><div className="flex flex-wrap gap-2">{shelf.sensors.map((sensor) => <StatusBadge key={sensor.id} tone={sensor.health === 'HEALTHY' ? 'healthy' : 'critical'}>{sensor.type} · {sensor.health}</StatusBadge>)}</div>{shelf.device && devices?.some((device) => device.deviceId === shelf.device.deviceId && device.status !== shelf.status) && <p className="mt-3 text-xs text-amber-200">Device connection state is based on the most recent sensor heartbeat.</p>}</section>

      {editing && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4"><section role="dialog" aria-modal="true" aria-labelledby="edit-shelf-title" className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 p-6"><h3 id="edit-shelf-title" className="text-xl font-semibold text-white">Edit shelf</h3><form onSubmit={submitEdit} className="mt-5 space-y-4"><label className="block text-sm text-slate-300">Name<input name="name" required defaultValue={shelf.name} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label><label className="block text-sm text-slate-300">Capacity (kg)<input name="maxCapacity" type="number" min="0.1" step="0.1" required defaultValue={shelf.maxCapacity} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label><label className="block text-sm text-slate-300">Device<select name="deviceId" defaultValue={shelf.device.deviceId} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white">{devices?.map((device) => <option key={device.id} value={device.deviceId}>{device.name}</option>)}</select></label><div className="flex justify-end gap-3"><button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">Cancel</button><button disabled={updateShelf.isPending} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950">Save shelf</button></div></form></section></div>}
    </div>
  );
};

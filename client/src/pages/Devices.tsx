import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Activity, Cpu, Gauge, RadioTower, Signal } from 'lucide-react';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Link } from 'react-router-dom';
import { api, getApiErrorMessage } from '../lib/api';

export const DevicesPage = () => {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const { data: devices, isLoading, isError, error, refetch } = useQuery({ queryKey: ['devices'], queryFn: api.getDevices });
  const addDevice = useMutation({
    mutationFn: api.createDevice,
    onSuccess: () => { setAddOpen(false); setFeedback('Device registered.'); void queryClient.invalidateQueries({ queryKey: ['devices'] }); void queryClient.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (cause) => setFeedback(getApiErrorMessage(cause, 'The device could not be registered.')),
  });
  const removeDevice = useMutation({
    mutationFn: api.deleteDevice,
    onSuccess: () => { setFeedback('Device deleted.'); void queryClient.invalidateQueries({ queryKey: ['devices'] }); },
    onError: (cause) => setFeedback(getApiErrorMessage(cause, 'The device could not be deleted.')),
  });

  function submitDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    addDevice.mutate({ deviceId: String(form.get('deviceId')), name: String(form.get('name')), ipAddress: String(form.get('ipAddress') || ''), firmware: String(form.get('firmware') || '') });
  }

  if (isLoading) return <div className="grid gap-4 xl:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />)}</div>;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Devices</p><h2 className="mt-2 text-3xl font-semibold text-white">IoT device network</h2><p className="mt-1 text-sm text-slate-400">Registered ESP32 controllers and their assigned sensors.</p></div><button onClick={() => { setFeedback(''); setAddOpen(true); }} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950">+ Register device</button></section>
      {feedback && <p role="status" className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-200">{feedback}</p>}
      {isError && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-100">{getApiErrorMessage(error, 'Could not load devices.')} <button onClick={() => void refetch()} className="ml-2 underline">Retry</button></div>}
      {!isError && devices?.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">No devices are registered.</div>}
      <div className="grid gap-4 xl:grid-cols-2">{devices?.map((device, index) => {
        const tone = device.status === 'ONLINE' ? 'online' : 'critical';
        const sensorList = device.shelves.flatMap((shelf) => shelf.sensors);
        const healthySensors = sensorList.filter((sensor) => sensor.health === 'HEALTHY').length;
        return <motion.article key={device.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="mb-5 flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300"><Cpu className="h-5 w-5" /></div><div><p className="text-lg font-semibold text-white">{device.name}</p><p className="text-sm text-slate-400">{device.deviceId}</p></div></div><StatusBadge tone={tone}>{device.status}</StatusBadge></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center gap-2 text-xs uppercase text-slate-400"><Signal className="h-3.5 w-3.5" /> Last heartbeat</div><p className="mt-2 text-sm font-medium text-white">{device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never received'}</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center gap-2 text-xs uppercase text-slate-400"><Activity className="h-3.5 w-3.5" /> Firmware</div><p className="mt-2 text-sm font-medium text-white">{device.firmware || 'Not reported'}</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center gap-2 text-xs uppercase text-slate-400"><Gauge className="h-3.5 w-3.5" /> Sensor health</div><p className="mt-2 text-sm font-medium text-white">{sensorList.length ? `${healthySensors}/${sensorList.length} healthy` : 'No sensors registered'}</p></div></div>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4"><div className="mb-3 flex items-center gap-2 text-xs uppercase text-slate-400"><RadioTower className="h-3.5 w-3.5" /> Sensors</div><div className="flex flex-wrap gap-2">{sensorList.map((sensor) => <StatusBadge key={sensor.id} tone={sensor.health === 'HEALTHY' ? 'healthy' : 'critical'}>{sensor.type} · {sensor.health}</StatusBadge>)}</div></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4"><div className="flex flex-wrap gap-2">{device.shelves.map((shelf) => <Link key={shelf.shelfId} to={`/shelves/${encodeURIComponent(shelf.shelfId)}`} className="text-sm text-emerald-200 hover:underline">{shelf.name}</Link>)}{device.ipAddress && <span className="text-xs text-slate-500">IP {device.ipAddress}</span>}</div><button onClick={() => { if (window.confirm(`Delete device ${device.deviceId}? Devices linked to shelves or telemetry cannot be deleted.`)) removeDevice.mutate(device.deviceId); }} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-rose-200">Delete</button></div>
        </motion.article>;
      })}</div>
      {addOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4"><section role="dialog" aria-modal="true" aria-labelledby="register-device-title" className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 p-6"><h3 id="register-device-title" className="text-xl font-semibold text-white">Register ESP32 device</h3><form onSubmit={submitDevice} className="mt-5 space-y-4"><label className="block text-sm text-slate-300">Device ID<input name="deviceId" required placeholder="PANTRY-ESP32-03" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label><label className="block text-sm text-slate-300">Name<input name="name" required className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label><label className="block text-sm text-slate-300">IP address<input name="ipAddress" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label><label className="block text-sm text-slate-300">Firmware<input name="firmware" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label>{feedback && <p role="alert" className="text-sm text-rose-300">{feedback}</p>}<div className="flex justify-end gap-3"><button type="button" onClick={() => setAddOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">Cancel</button><button disabled={addDevice.isPending} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950">Register</button></div></form></section></div>}
    </div>
  );
};

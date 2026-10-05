import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Droplets, Gauge, Thermometer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { api } from '../lib/api';

export const ShelvesPage = () => {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const { data: shelves, isLoading, isError, refetch } = useQuery({
    queryKey: ['shelves'],
    queryFn: api.getShelves,
  });
  const { data: devices } = useQuery({ queryKey: ['devices'], queryFn: api.getDevices });
  const addShelf = useMutation({
    mutationFn: api.createShelf,
    onSuccess: () => {
      setAddOpen(false);
      setFormError('');
      void queryClient.invalidateQueries({ queryKey: ['shelves'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : 'Shelf could not be saved.'),
  });

  function submitShelf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    addShelf.mutate({
      shelfId: String(form.get('shelfId')),
      name: String(form.get('name')),
      maxCapacity: Number(form.get('maxCapacity')),
      deviceId: String(form.get('deviceId')),
    });
  }

  if (isLoading) return <div className="grid gap-5 xl:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />)}</div>;
  if (isError) return <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-100">Could not load shelves. <button onClick={() => void refetch()} className="ml-2 underline">Retry</button></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Shelves</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Physical storage fleet</h2>
        </div>
        <button onClick={() => setAddOpen(true)} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200">
          + Add Shelf
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {shelves?.map((shelf) => (
          <Link key={shelf.id} to={`/shelves/${encodeURIComponent(shelf.shelfId)}`} className="group block">
            <Card className="h-full overflow-hidden p-5 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-slate-700">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{shelf.device.name}</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{shelf.name}</h3>
                </div>
                <StatusBadge tone={shelf.status === 'ONLINE' ? 'online' : 'critical'}>{shelf.status}</StatusBadge>
              </div>

              <div className="mb-5 flex items-center justify-between text-sm text-slate-300">
                <span>{shelf.shelfId}</span>
                <span className="text-slate-400">{shelf.inventoryCount} batches · {shelf.sensors.length} sensors</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400">
                    <span>Utilization</span>
                    <span>{shelf.utilization === null ? 'No reading' : `${shelf.utilization.toFixed(0)}%`}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, shelf.utilization ?? 0)}%` }} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <Gauge className="h-3.5 w-3.5" /> Weight
                    </div>
                    <div className="text-lg font-semibold text-white">{shelf.currentWeight === null ? '—' : `${shelf.currentWeight.toFixed(1)} kg`}</div>
                    <div className="text-xs text-slate-400">/ {shelf.maxCapacity} kg</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <Thermometer className="h-3.5 w-3.5" /> Temp
                    </div>
                    <div className="text-lg font-semibold text-white">{shelf.temperature === null ? '—' : `${shelf.temperature.toFixed(1)}°C`}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <Droplets className="h-3.5 w-3.5" /> Humidity
                    </div>
                    <div className="text-lg font-semibold text-white">{shelf.humidity === null ? '—' : `${shelf.humidity.toFixed(0)}%`}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
                <div className="text-sm text-slate-300">VOC: <span className="font-medium text-white">{shelf.voc == null ? 'No reading' : shelf.voc.toFixed(1)}</span></div>
                <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-200">
                  View Shelf <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {!shelves?.length && <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">No shelves registered. Add a shelf to begin monitoring.</div>}

      {addOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="add-shelf-title" className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 p-6">
            <h3 id="add-shelf-title" className="text-xl font-semibold text-white">Register shelf</h3>
            <form onSubmit={submitShelf} className="mt-5 space-y-4">
              <label className="block text-sm text-slate-300">Shelf ID<input required name="shelfId" placeholder="shelf-D" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label>
              <label className="block text-sm text-slate-300">Name<input required name="name" placeholder="Dry storage" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label>
              <label className="block text-sm text-slate-300">Capacity (kg)<input required min="0.1" step="0.1" type="number" name="maxCapacity" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label>
              <label className="block text-sm text-slate-300">Connected device<select required name="deviceId" defaultValue="" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"><option value="" disabled>Select a device</option>{devices?.map((device) => <option key={device.id} value={device.deviceId}>{device.name} · {device.deviceId}</option>)}</select></label>
              {formError && <p role="alert" className="text-sm text-rose-300">{formError}</p>}
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setAddOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">Cancel</button><button disabled={addShelf.isPending || !devices?.length} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{addShelf.isPending ? 'Saving…' : 'Add shelf'}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

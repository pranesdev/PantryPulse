import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Database, Thermometer, Timer } from 'lucide-react';
import { api, getApiErrorMessage } from '../lib/api';

const descriptions: Record<string, { label: string; unit: string; description: string }> = {
  maxTemperature: { label: 'Maximum temperature', unit: '°C', description: 'Create an alert when a shelf exceeds this temperature.' },
  maxHumidity: { label: 'Maximum humidity', unit: '%', description: 'Create an alert when relative humidity exceeds this value.' },
  maxVOC: { label: 'Maximum VOC', unit: 'ppm', description: 'Create a critical alert when the reported VOC reading exceeds this value.' },
  maxWeightPercent: { label: 'Shelf capacity alert', unit: '%', description: 'Alert when measured weight exceeds this share of shelf capacity.' },
  deviceTimeoutMinutes: { label: 'Device offline timeout', unit: 'min', description: 'Mark a device offline after this many minutes without telemetry.' },
};

export const SettingsPage = () => {
  const queryClient = useQueryClient();
  const [draftValues, setDraftValues] = useState<Record<string, string> | null>(null);
  const [feedback, setFeedback] = useState('');
  const { data: settings, isLoading, isError, error, refetch } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const save = useMutation({ mutationFn: ({ key, value }: { key: string; value: string }) => api.updateSetting(key, value) });

  const values = draftValues ?? Object.fromEntries((settings ?? []).map(({ key, value }) => [key, value]));

  function setValue(key: string, value: string) {
    setDraftValues((current) => ({
      ...Object.fromEntries((settings ?? []).map((setting) => [setting.key, setting.value])),
      ...current,
      [key]: value,
    }));
  }

  async function saveChanges() {
    if (!settings) return;
    setFeedback('');
    const changed = settings.filter((setting) => values[setting.key] !== undefined && values[setting.key] !== setting.value);
    try {
      await Promise.all(changed.map(({ key }) => save.mutateAsync({ key, value: values[key] })));
      setFeedback(changed.length ? 'Settings saved.' : 'There are no unsaved changes.');
      setDraftValues(null);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (cause) {
      setFeedback(getApiErrorMessage(cause, 'Settings could not be saved. Review the values and retry.'));
    }
  }

  const dirty = settings?.some((setting) => values[setting.key] !== undefined && values[setting.key] !== setting.value) ?? false;

  if (isLoading) return <div className="space-y-4">{[1, 2].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />)}</div>;
  if (isError) return <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-100">{getApiErrorMessage(error, 'Could not load settings.')} <button onClick={() => void refetch()} className="ml-2 underline">Retry</button></div>;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Configuration</p><h2 className="mt-2 text-3xl font-semibold text-white">Monitoring and alerts</h2><p className="mt-2 text-sm text-slate-400">Only settings persisted by the current backend are editable here.</p></section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="mb-5 flex items-center gap-3"><Thermometer className="h-5 w-5 text-emerald-300" /><div><h3 className="font-semibold text-white">Thresholds and device health</h3><p className="text-sm text-slate-400">Applied to incoming sensor telemetry.</p></div></div><div className="grid gap-3 md:grid-cols-2">{settings?.filter(({ key }) => key in descriptions).map((setting) => { const meta = descriptions[setting.key]; return <label key={setting.key} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><span className="text-sm font-medium text-slate-200">{meta.label}</span><span className="mt-1 block text-xs text-slate-400">{meta.description}</span><span className="mt-3 flex items-center gap-2"><input type="number" min="0.1" step="0.1" value={values[setting.key] ?? setting.value} onChange={(event) => setValue(setting.key, event.target.value)} className="w-32 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /><span className="text-sm text-slate-400">{meta.unit}</span></span></label>; })}</div></section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="mb-5 flex items-center gap-3"><BellRing className="h-5 w-5 text-amber-300" /><div><h3 className="font-semibold text-white">Alert behavior</h3><p className="text-sm text-slate-400">Enable or pause telemetry threshold alerts.</p></div></div>{settings?.filter(({ key }) => key === 'alertsEnabled').map((setting) => <label key={setting.key} className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4"><span><span className="block text-sm font-medium text-slate-200">Threshold alerts</span><span className="text-xs text-slate-400">Temperature, humidity, VOC, and capacity alerts.</span></span><input type="checkbox" checked={(values[setting.key] ?? setting.value) === 'true'} onChange={(event) => setValue(setting.key, String(event.target.checked))} className="h-5 w-5 accent-emerald-400" /></label>)}</section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="mb-4 flex items-center gap-3"><Database className="h-5 w-5 text-sky-300" /><div><h3 className="font-semibold text-white">Runtime mode</h3><p className="text-sm text-slate-400">Demo mode is controlled by the server environment and is read-only.</p></div></div>{settings?.filter(({ key }) => key === 'demoMode').map((setting) => <div key={setting.key} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-4"><span className="text-sm text-slate-300">Demo data source</span><span className={`rounded-full border px-3 py-1 text-xs ${setting.value === 'true' ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{setting.value === 'true' ? 'DEMO MODE' : 'LIVE MODE'}</span></div>)}</section>

      {feedback && <p role="status" className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-200">{feedback}</p>}
      <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-xs text-slate-500"><Timer className="h-3.5 w-3.5" /> Changes apply to the next telemetry reading.</span><button disabled={!dirty || save.isPending} onClick={() => void saveChanges()} className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-50">{save.isPending ? 'Saving…' : 'Save changes'}</button></div>
    </div>
  );
};

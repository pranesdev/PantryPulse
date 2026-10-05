import { useDeferredValue, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, ScanLine, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api, getApiErrorMessage } from '../lib/api';
import { StatusBadge } from '../components/ui/StatusBadge';

const statusLabels: Record<string, string> = {
  GOOD: 'Fresh',
  EXPIRING_SOON: 'Expiring soon',
  EXPIRED: 'Expired',
  SURPLUS: 'Surplus',
  DONATION: 'Donated',
  USED: 'Used',
  DISMISSED: 'Dismissed',
};

export const InventoryPage = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [shelfId, setShelfId] = useState('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('expiryDate');
  const [editingId, setEditingId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [rfidTag, setRfidTag] = useState('');
  const [rfidResult, setRfidResult] = useState<{ message: string; error: boolean } | null>(null);
  const deferredSearch = useDeferredValue(search);
  const { data: shelves } = useQuery({ queryKey: ['shelves'], queryFn: api.getShelves });
  const { data: filterItems } = useQuery({ queryKey: ['inventory', 'filter-options'], queryFn: () => api.getInventory() });
  const { data: items, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventory', deferredSearch, shelfId, category],
    queryFn: () => api.getInventory({ search: deferredSearch, shelfId, category }),
  });
  const { data: surplus } = useQuery({ queryKey: ['surplus'], queryFn: api.getSurplus });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['surplus'] });
  };
  const createItem = useMutation({ mutationFn: api.createInventory, onSuccess: () => { setEditorOpen(false); setFeedback('Batch added.'); invalidate(); }, onError: (cause) => setFeedback(getApiErrorMessage(cause, 'The batch could not be saved.')) });
  const updateItem = useMutation({ mutationFn: ({ id, values }: { id: string; values: Parameters<typeof api.updateInventory>[1] }) => api.updateInventory(id, values), onSuccess: () => { setEditorOpen(false); setFeedback('Changes saved.'); invalidate(); }, onError: (cause) => setFeedback(getApiErrorMessage(cause, 'Changes could not be saved.')) });
  const deleteItem = useMutation({ mutationFn: api.deleteInventory, onSuccess: () => { setFeedback('Inventory item deleted.'); invalidate(); }, onError: (cause) => setFeedback(getApiErrorMessage(cause, 'The item could not be deleted.')) });
  const markSurplus = useMutation({ mutationFn: api.createSurplus, onSuccess: () => { setFeedback('Item marked as surplus.'); invalidate(); }, onError: (cause) => setFeedback(getApiErrorMessage(cause, 'The item could not be marked as surplus.')) });
  const surplusAction = useMutation({ mutationFn: ({ id, action }: { id: string; action: 'DONATION' | 'USED' | 'DISMISSED' }) => api.updateSurplusAction(id, action), onSuccess: () => { setFeedback('Surplus action saved.'); invalidate(); }, onError: (cause) => setFeedback(getApiErrorMessage(cause, 'The surplus action could not be saved.')) });
  const scan = useMutation({ mutationFn: api.scanRfid, onSuccess: (match) => setRfidResult({ message: `${match.food} · ${match.batch} · ${match.inventory.map((item) => item.shelfName).join(', ') || 'No shelf assignment'}`, error: false }), onError: (cause) => setRfidResult({ message: getApiErrorMessage(cause, 'RFID lookup failed.'), error: true }) });
  const rows = useMemo(() => [...(items ?? [])]
    .filter((item) => status === 'all' || item.status === status)
    .sort((a, b) => String(a[sort as keyof typeof a] ?? '').localeCompare(String(b[sort as keyof typeof b] ?? ''), undefined, { numeric: true })), [items, sort, status]);
  const editing = items?.find((item) => item.id === editingId);

  function openEditor(id = '') {
    setEditingId(id);
    setEditorOpen(true);
    setFeedback('');
  }

  function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      food: String(form.get('food')),
      category: String(form.get('category')),
      quantity: Number(form.get('quantity')),
      weight: Number(form.get('weight')),
      expiryDate: new Date(String(form.get('expiryDate'))).toISOString(),
      shelfId: String(form.get('shelfId')),
      rfidTagId: String(form.get('rfidTagId') || '').trim() || null,
    };
    if (editingId) updateItem.mutate({ id: editingId, values });
    else createItem.mutate({ ...values, batch: String(form.get('batch')) });
  }

  function submitScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRfidResult(null);
    scan.mutate(rfidTag.trim());
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Inventory</p><h2 className="mt-2 text-3xl font-semibold text-white">Food and batch records</h2></div>
        <button onClick={() => openEditor()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950"><Plus className="h-4 w-4" /> Add batch</button>
      </section>

      <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs text-slate-400">Search<input aria-label="Search inventory" value={search} onChange={(event) => { setSearch(event.target.value); setSearchParams(event.target.value ? { search: event.target.value } : {}); }} placeholder="Food, batch, RFID" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs text-slate-400">Shelf<select value={shelfId} onChange={(event) => setShelfId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="all">All shelves</option>{shelves?.map((shelf) => <option key={shelf.shelfId} value={shelf.shelfId}>{shelf.name}</option>)}</select></label>
        <label className="text-xs text-slate-400">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="all">All categories</option>{[...new Set((filterItems ?? []).map((item) => item.category))].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs text-slate-400">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="all">All statuses</option>{['GOOD', 'EXPIRING_SOON', 'EXPIRED', 'SURPLUS', 'DONATION', 'USED', 'DISMISSED'].map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
        <label className="text-xs text-slate-400">Sort<select value={sort} onChange={(event) => setSort(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="expiryDate">Expiry date</option><option value="food">Food name</option><option value="quantity">Quantity</option><option value="weight">Weight</option></select></label>
      </section>

      <form onSubmit={submitScan} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <ScanLine className="h-4 w-4 text-emerald-300" /><label htmlFor="rfid-input" className="text-sm text-slate-300">RFID lookup</label><input id="rfid-input" value={rfidTag} onChange={(event) => setRfidTag(event.target.value)} placeholder="Scan or enter tag ID" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><button disabled={!rfidTag.trim() || scan.isPending} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-emerald-200 disabled:opacity-50">{scan.isPending ? 'Looking up…' : 'Look up'}</button>
        {rfidResult && <p role={rfidResult.error ? 'alert' : 'status'} className={`basis-full text-sm ${rfidResult.error ? 'text-rose-300' : 'text-emerald-200'}`}>{rfidResult.message}</p>}
      </form>
      {feedback && <p role="status" className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-200">{feedback}</p>}

      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950/70 text-slate-300"><tr>{['Food', 'Category', 'Batch', 'Shelf', 'Qty', 'Weight', 'Expiry', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-4 py-4 font-medium">{heading}</th>)}</tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-400">Loading inventory…</td></tr>}
            {isError && <tr><td colSpan={9} className="px-5 py-10 text-center text-rose-200">{getApiErrorMessage(error, 'Could not load inventory.')} <button onClick={() => void refetch()} className="underline">Retry</button></td></tr>}
            {!isLoading && !isError && rows.map((item) => <tr key={item.id} className="border-t border-slate-800 text-slate-200 hover:bg-slate-800/40"><td className="px-4 py-4 font-medium text-white">{item.food}</td><td className="px-4 py-4">{item.category}</td><td className="px-4 py-4">{item.batch}</td><td className="px-4 py-4">{item.shelfName}</td><td className="px-4 py-4">{item.quantity}</td><td className="px-4 py-4">{item.weight.toFixed(1)} kg</td><td className="px-4 py-4">{new Date(item.expiryDate).toLocaleDateString()}</td><td className="px-4 py-4"><StatusBadge tone={item.status === 'EXPIRED' ? 'critical' : item.status === 'EXPIRING_SOON' ? 'warning' : item.status === 'GOOD' ? 'healthy' : 'info'}>{statusLabels[item.status] ?? item.status}</StatusBadge></td><td className="px-4 py-4"><div className="flex items-center gap-2"><button onClick={() => openEditor(item.id)} aria-label={`Edit ${item.food}`} className="rounded-md border border-slate-700 p-2 text-slate-300"><Pencil className="h-4 w-4" /></button>{!item.surplusId && <button onClick={() => markSurplus.mutate(item.id)} className="rounded-md border border-slate-700 px-2 py-1.5 text-xs text-amber-200">Surplus</button>}<button onClick={() => { if (window.confirm(`Delete ${item.food} (${item.batch})?`)) deleteItem.mutate(item.id); }} aria-label={`Delete ${item.food}`} className="rounded-md border border-slate-700 p-2 text-rose-300"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}
            {!isLoading && !isError && rows.length === 0 && <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">No inventory matches these filters.</td></tr>}
          </tbody>
        </table></div>
      </section>

      {!!surplus?.length && <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><h3 className="text-lg font-semibold text-white">Surplus actions</h3><div className="mt-3 divide-y divide-slate-800">{surplus.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-medium text-white">{item.food} <span className="text-sm font-normal text-slate-400">· {item.weight} kg · {item.shelfName}</span></div><div className="text-xs text-slate-400">Detected {new Date(item.detectedAt).toLocaleDateString()} · {item.action ?? 'Action needed'}</div></div>{item.action ? <StatusBadge tone="info">{item.action}</StatusBadge> : <select aria-label={`Choose action for ${item.food}`} defaultValue="" onChange={(event) => { if (event.target.value) surplusAction.mutate({ id: item.id, action: event.target.value as 'DONATION' | 'USED' | 'DISMISSED' }); }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="" disabled>Choose action</option><option value="DONATION">Donate</option><option value="USED">Mark used</option><option value="DISMISSED">Dismiss</option></select>}</div>)}</div></section>}

      {editorOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4"><section role="dialog" aria-modal="true" aria-labelledby="inventory-editor-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-6"><h3 id="inventory-editor-title" className="text-xl font-semibold text-white">{editing ? 'Edit inventory item' : 'Add batch'}</h3><form onSubmit={submitItem} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-300">Food<input name="food" required defaultValue={editing?.food} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label><label className="text-sm text-slate-300">Category<input name="category" required defaultValue={editing?.category} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label>{!editing && <label className="text-sm text-slate-300">Batch ID<input name="batch" required className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label>}<label className="text-sm text-slate-300">Quantity<input name="quantity" type="number" min="0" required defaultValue={editing?.quantity} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label><label className="text-sm text-slate-300">Weight (kg)<input name="weight" type="number" min="0" step="0.1" required defaultValue={editing?.weight} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label><label className="text-sm text-slate-300">Expiry date<input name="expiryDate" type="date" required defaultValue={editing?.expiryDate.slice(0, 10)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label><label className="text-sm text-slate-300">Shelf<select name="shelfId" required defaultValue={editing?.shelfId ?? ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"><option value="" disabled>Select shelf</option>{shelves?.map((shelf) => <option key={shelf.shelfId} value={shelf.shelfId}>{shelf.name}</option>)}</select></label><label className="text-sm text-slate-300">RFID tag<input name="rfidTagId" defaultValue={editing?.rfidTagId ?? ''} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label>{feedback && <p role="alert" className="sm:col-span-2 text-sm text-rose-300">{feedback}</p>}<div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200">Cancel</button><button disabled={createItem.isPending || updateItem.isPending} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950">Save</button></div></form></section></div>}
    </div>
  );
};

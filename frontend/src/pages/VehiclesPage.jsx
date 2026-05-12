import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newPlate, setNewPlate] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newType, setNewType] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const data = await api.request('/api/vehicles');
    setVehicles(data.vehicles || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError('');
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    const plate = newPlate.trim();
    if (!plate) return;
    setBusy(true);
    setError('');
    try {
      await api.request('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          licensePlate: plate,
          brand: newBrand.trim() || undefined,
          vehicleType: newType.trim() || undefined,
        }),
      });
      setNewPlate('');
      setNewBrand('');
      setNewType('');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      await api.request(`/api/vehicles/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          licensePlate: editing.licensePlate.trim(),
          brand: editing.brand?.trim() || null,
          vehicleType: editing.vehicleType?.trim() || null,
        }),
      });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#1a1f36]">Транспортні засоби</h1>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={handleCreate}
        className="mt-6 flex flex-col gap-3 rounded-xl border border-[#e6ebf1] bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs font-medium text-[#4f566b]">Номерний знак *</label>
          <input
            className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
            value={newPlate}
            onChange={(e) => setNewPlate(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="text-xs font-medium text-[#4f566b]">Марка</label>
          <input
            className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="text-xs font-medium text-[#4f566b]">Тип</label>
          <input
            className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={busy || !newPlate.trim()}
          className="rounded-md bg-[#635bff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5851e6] disabled:opacity-50"
        >
          Додати
        </button>
      </form>

      <div className="mt-8 overflow-hidden rounded-xl border border-[#e6ebf1] bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-[#4f566b]">Завантаження…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#e6ebf1] bg-slate-50 text-xs font-semibold uppercase text-[#4f566b]">
                <tr>
                  <th className="px-4 py-3">Номер</th>
                  <th className="px-4 py-3">Марка</th>
                  <th className="px-4 py-3">Тип</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3 text-right">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ebf1]">
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3 font-medium text-[#1a1f36]">{v.licensePlate}</td>
                    <td className="px-4 py-3 text-[#4f566b]">{v.brand || '—'}</td>
                    <td className="px-4 py-3 text-[#4f566b]">{v.vehicleType || '—'}</td>
                    <td className="px-4 py-3">
                      {v.onParking ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          На парковці
                        </span>
                      ) : (
                        <span className="text-xs text-[#4f566b]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setEditing({
                            id: v.id,
                            licensePlate: v.licensePlate,
                            brand: v.brand || '',
                            vehicleType: v.vehicleType || '',
                          })
                        }
                        className="text-xs font-semibold text-[#635bff] hover:underline"
                      >
                        Змінити
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#e6ebf1] bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-[#1a1f36]">Редагування ТЗ</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-[#4f566b]">Номер</label>
                <input
                  className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                  value={editing.licensePlate}
                  onChange={(e) => setEditing({ ...editing, licensePlate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#4f566b]">Марка</label>
                <input
                  className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                  value={editing.brand}
                  onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#4f566b]">Тип</label>
                <input
                  className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                  value={editing.vehicleType}
                  onChange={(e) => setEditing({ ...editing, vehicleType: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(null)}
                className="rounded-md border border-[#e6ebf1] px-4 py-2 text-sm"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveEdit}
                className="rounded-md bg-[#635bff] px-4 py-2 text-sm font-semibold text-white"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

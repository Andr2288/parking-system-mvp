import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';

function StatusBadge({ status }) {
  const isFree = status === 'free';
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        isFree ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800',
      ].join(' ')}
    >
      {isFree ? 'Вільно' : 'Зайнято'}
    </span>
  );
}

export default function ParkingSpotsPage() {
  const [spots, setSpots] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalSpot, setModalSpot] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [newPlate, setNewPlate] = useState('');
  const [busy, setBusy] = useState(false);

  const loadSpots = useCallback(async () => {
    const data = await api.request('/api/parking-spots');
    setSpots(data.spots || []);
  }, []);

  const loadVehicles = useCallback(async () => {
    const data = await api.request('/api/vehicles');
    setVehicles(data.vehicles || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError('');
      setLoading(true);
      try {
        await loadSpots();
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSpots]);

  async function openStartModal(spot) {
    setError('');
    setModalSpot(spot);
    setSelectedVehicleId('');
    setNewPlate('');
    try {
      await loadVehicles();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleAddVehicle() {
    const plate = newPlate.trim();
    if (!plate) return;
    setBusy(true);
    setError('');
    try {
      const data = await api.request('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify({ licensePlate: plate }),
      });
      await loadVehicles();
      setSelectedVehicleId(String(data.vehicle.id));
      setNewPlate('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStartSession() {
    if (!modalSpot || !selectedVehicleId) return;
    setBusy(true);
    setError('');
    try {
      await api.request('/api/parking-sessions', {
        method: 'POST',
        body: JSON.stringify({
          parkingSpotId: modalSpot.id,
          vehicleId: Number(selectedVehicleId),
        }),
      });
      setModalSpot(null);
      await loadSpots();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleEndSession(sessionId) {
    if (!sessionId) return;
    setBusy(true);
    setError('');
    try {
      await api.request(`/api/parking-sessions/${sessionId}/end`, { method: 'POST' });
      await loadSpots();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1f36]">Паркомісця</h1>
          <p className="text-sm text-[#4f566b]">Статус місць і початок / завершення паркування.</p>
        </div>
        <button
          type="button"
          onClick={() => loadSpots().catch((e) => setError(e.message))}
          className="self-start rounded-md border border-[#e6ebf1] bg-white px-3 py-2 text-sm font-medium text-[#1a1f36] hover:bg-slate-50"
        >
          Оновити
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#e6ebf1] bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-[#4f566b]">Завантаження…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#e6ebf1] bg-slate-50 text-xs font-semibold uppercase tracking-wide text-[#4f566b]">
                <tr>
                  <th className="px-4 py-3">Номер</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Зона</th>
                  <th className="px-4 py-3 text-right">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ebf1]">
                {spots.map((s) => (
                  <tr key={s.id} className="text-[#1a1f36]">
                    <td className="px-4 py-3 font-medium">{s.spotNumber}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-[#4f566b]">{s.zone || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {s.status === 'free' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openStartModal(s)}
                          className="rounded-md bg-[#635bff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5851e6] disabled:opacity-50"
                        >
                          Зайняти
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy || !s.activeSessionId}
                          onClick={() => handleEndSession(s.activeSessionId)}
                          className="rounded-md border border-[#e6ebf1] bg-white px-3 py-1.5 text-xs font-semibold text-[#1a1f36] hover:bg-slate-50 disabled:opacity-50"
                        >
                          Звільнити
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalSpot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#e6ebf1] bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-[#1a1f36]">
              Початок паркування — {modalSpot.spotNumber}
            </h2>
            <p className="mt-1 text-sm text-[#4f566b]">Оберіть ТЗ з довідника або додайте новий номер.</p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1a1f36]" htmlFor="vehicle">
                  Транспортний засіб
                </label>
                <select
                  id="vehicle"
                  className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-[#1a1f36]"
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                >
                  <option value="">— оберіть —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id} disabled={v.onParking}>
                      {v.licensePlate}
                      {v.onParking ? ' (на парковці)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                  placeholder="Новий номерний знак"
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !newPlate.trim()}
                  onClick={handleAddVehicle}
                  className="rounded-md border border-[#e6ebf1] bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  Додати
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setModalSpot(null)}
                className="rounded-md border border-[#e6ebf1] bg-white px-4 py-2 text-sm font-medium"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={busy || !selectedVehicleId}
                onClick={handleStartSession}
                className="rounded-md bg-[#635bff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5851e6] disabled:opacity-50"
              >
                Почати
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

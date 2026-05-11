import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';

const ZONE_COLOR_PRESETS = [
  { label: 'Зелений', value: '#16a34a' },
  { label: 'Синій', value: '#2563eb' },
  { label: 'Фіолетовий', value: '#7c3aed' },
  { label: 'Помаранчевий', value: '#ea580c' },
  { label: 'Бірюзовий', value: '#0d9488' },
  { label: 'Сірий', value: '#64748b' },
];

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

function ZoneCell({ zone, zoneColor }) {
  if (!zone) {
    return <span className="text-[#4f566b]">—</span>;
  }
  const border = zoneColor && /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/i.test(zoneColor) ? zoneColor : '#94a3b8';
  return (
    <span
      className="inline-block max-w-[200px] truncate rounded-md border border-[#e6ebf1] bg-white px-2 py-1 text-xs font-medium text-[#1a1f36]"
      style={{ borderLeftWidth: 4, borderLeftColor: border }}
      title={zone}
    >
      {zone}
    </span>
  );
}

function formatCoeff(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '1';
  return String(Math.round(n * 10000) / 10000).replace(/\.?0+$/, '') || '1';
}

export default function ParkingSpotsPage() {
  const [spots, setSpots] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalSpot, setModalSpot] = useState(null);
  const [editSpot, setEditSpot] = useState(null);
  const [editZone, setEditZone] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editCoeff, setEditCoeff] = useState('1');
  const [editColor, setEditColor] = useState('');
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

  function openEdit(spot) {
    setError('');
    setEditSpot(spot);
    setEditZone(spot.zone || '');
    setEditNote(spot.note || '');
    setEditCoeff(formatCoeff(spot.priceCoefficient ?? 1));
    setEditColor(spot.zoneColor || '');
  }

  async function saveEdit() {
    if (!editSpot) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        zone: editZone,
        note: editNote,
        priceCoefficient: Number(editCoeff),
        zoneColor: editColor.trim() || null,
      };
      await api.request(`/api/parking-spots/${editSpot.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setEditSpot(null);
      await loadSpots();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

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
          <p className="text-sm text-[#4f566b]">
            Статус місць, зона та коефіцієнт оплати (множник до суми за тарифом), редагування місця.
          </p>
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
                  <th className="px-4 py-3">Коеф.</th>
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
                    <td className="px-4 py-3">
                      <ZoneCell zone={s.zone} zoneColor={s.zoneColor} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[#4f566b]">{formatCoeff(s.priceCoefficient ?? 1)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openEdit(s)}
                        className="mr-2 rounded-md border border-[#e6ebf1] bg-white px-2 py-1.5 text-xs font-semibold text-[#1a1f36] hover:bg-slate-50"
                      >
                        Змінити
                      </button>
                      {s.status === 'free' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openStartModal(s)}
                          className="rounded-md bg-[#635bff] px-2 py-1.5 text-xs font-semibold text-white hover:bg-[#5851e6] disabled:opacity-50"
                        >
                          Зайняти
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy || !s.activeSessionId}
                          onClick={() => handleEndSession(s.activeSessionId)}
                          className="rounded-md border border-[#e6ebf1] bg-white px-2 py-1.5 text-xs font-semibold text-[#1a1f36] hover:bg-slate-50 disabled:opacity-50"
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

      {editSpot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#e6ebf1] bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-[#1a1f36]">Місце {editSpot.spotNumber}</h2>
            <p className="mt-1 text-sm text-[#4f566b]">
              Зона (текст), колір мітки, примітка та коефіцієнт до суми за тарифом (1 = без зміни, 0.5 = вдвічі дешевше).
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#1a1f36]">Зона</label>
                <input
                  className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                  placeholder="Напр.: для людей з інвалідністю, електромобілів…"
                  value={editZone}
                  onChange={(e) => setEditZone(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1a1f36]">Колір мітки зони</label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    className="h-10 w-14 cursor-pointer rounded border border-[#e6ebf1] bg-white p-1"
                    value={/^#[0-9A-Fa-f]{6}$/i.test(editColor) ? editColor : '#635bff'}
                    onChange={(e) => setEditColor(e.target.value)}
                  />
                  <input
                    className="min-w-0 flex-1 rounded-md border border-[#e6ebf1] px-3 py-2 font-mono text-sm"
                    placeholder="#22c55e або порожньо"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value.trim())}
                  />
                  <button
                    type="button"
                    className="rounded-md border border-[#e6ebf1] px-2 py-1 text-xs"
                    onClick={() => setEditColor('')}
                  >
                    Без кольору
                  </button>
                </div>
                <p className="mt-1 text-xs text-[#4f566b]">Формат: #RGB або #RRGGBB. Швидкий вибір:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ZONE_COLOR_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      className="rounded-full border border-[#e6ebf1] px-2 py-1 text-xs hover:bg-slate-50"
                      style={{ borderLeftWidth: 4, borderLeftColor: p.value }}
                      onClick={() => setEditColor(p.value)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1a1f36]">Примітка</label>
                <input
                  className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                  placeholder="Внутрішня примітка (необов’язково)"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  maxLength={255}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1a1f36]">Коефіцієнт оплати</label>
                <input
                  type="number"
                  min="0.01"
                  max="10"
                  step="0.01"
                  className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 font-mono text-sm"
                  value={editCoeff}
                  onChange={(e) => setEditCoeff(e.target.value)}
                />
                <p className="mt-1 text-xs text-[#4f566b]">
                  Підсумок за сесію = сума за тарифом (день/ніч тощо) × коефіцієнт. За замовчуванням 1.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditSpot(null)}
                className="rounded-md border border-[#e6ebf1] bg-white px-4 py-2 text-sm font-medium"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveEdit}
                className="rounded-md bg-[#635bff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5851e6]"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

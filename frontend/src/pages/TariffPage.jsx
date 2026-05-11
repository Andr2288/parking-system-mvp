import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';

function timeInputValue(v) {
  if (v == null || v === '') return '08:00';
  const s = String(v);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

export default function TariffPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [pricePerHour, setPricePerHour] = useState('20');
  const [minPrice, setMinPrice] = useState('20');
  const [smartMode, setSmartMode] = useState(false);
  const [smartType, setSmartType] = useState('day_night');
  const [dayPrice, setDayPrice] = useState('20');
  const [nightPrice, setNightPrice] = useState('10');
  const [weekdayPrice, setWeekdayPrice] = useState('20');
  const [weekendPrice, setWeekendPrice] = useState('15');
  const [dayStart, setDayStart] = useState('08:00');
  const [dayEnd, setDayEnd] = useState('22:00');

  const applyTariff = useCallback((t) => {
    setPricePerHour(String(t.pricePerHour ?? ''));
    setMinPrice(String(t.minPrice ?? ''));
    setSmartMode(Boolean(t.smartMode));
    setSmartType(t.smartType === 'weekday_weekend' ? 'weekday_weekend' : 'day_night');
    setDayPrice(String(t.dayPrice ?? '20'));
    setNightPrice(String(t.nightPrice ?? '10'));
    setWeekdayPrice(String(t.weekdayPrice ?? '20'));
    setWeekendPrice(String(t.weekendPrice ?? '15'));
    setDayStart(timeInputValue(t.dayStart));
    setDayEnd(timeInputValue(t.dayEnd));
  }, []);

  const load = useCallback(async () => {
    const data = await api.request('/api/tariffs/current');
    applyTariff(data.tariff);
  }, [applyTariff]);

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

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const body = {
        pricePerHour: Number(pricePerHour),
        minPrice: Number(minPrice),
        smartMode,
        smartType: smartMode ? smartType : null,
        dayPrice: smartMode && smartType === 'day_night' ? Number(dayPrice) : null,
        nightPrice: smartMode && smartType === 'day_night' ? Number(nightPrice) : null,
        weekdayPrice: smartMode && smartType === 'weekday_weekend' ? Number(weekdayPrice) : null,
        weekendPrice: smartMode && smartType === 'weekday_weekend' ? Number(weekendPrice) : null,
        dayStart: smartMode && smartType === 'day_night' ? `${dayStart}:00` : null,
        dayEnd: smartMode && smartType === 'day_night' ? `${dayEnd}:00` : null,
      };
      const data = await api.request('/api/tariffs/current', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      applyTariff(data.tariff);
      setSuccess('Тариф збережено. Нові значення застосовуються до нових сесій.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#1a1f36]">Тарифи</h1>
      <p className="mt-1 text-sm text-[#4f566b]">
        Базова ставка та мінімальна ціна; опційно розумні тарифи (день/ніч або будні/вихідні).
      </p>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 text-[#4f566b]">Завантаження…</div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-8 max-w-xl space-y-6 rounded-xl border border-[#e6ebf1] bg-white p-6 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-[#1a1f36]">Ціна за годину (базова)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                value={pricePerHour}
                onChange={(e) => setPricePerHour(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#1a1f36]">Мінімальна ціна</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="smart"
              type="checkbox"
              checked={smartMode}
              onChange={(e) => setSmartMode(e.target.checked)}
              className="h-4 w-4 rounded border-[#e6ebf1] text-[#635bff] focus:ring-[#635bff]"
            />
            <label htmlFor="smart" className="text-sm font-medium text-[#1a1f36]">
              Увімкнути розумні тарифи
            </label>
          </div>

          {smartMode ? (
            <div className="space-y-4 border-t border-[#e6ebf1] pt-4">
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="smartType"
                    checked={smartType === 'day_night'}
                    onChange={() => setSmartType('day_night')}
                  />
                  День / ніч
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="smartType"
                    checked={smartType === 'weekday_weekend'}
                    onChange={() => setSmartType('weekday_weekend')}
                  />
                  Будні / вихідні
                </label>
              </div>

              {smartType === 'day_night' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Ціна «день» за годину</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                      value={dayPrice}
                      onChange={(e) => setDayPrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Ціна «ніч» за годину</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                      value={nightPrice}
                      onChange={(e) => setNightPrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Початок «дня»</label>
                    <input
                      type="time"
                      className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                      value={dayStart}
                      onChange={(e) => setDayStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Кінець «дня»</label>
                    <input
                      type="time"
                      className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                      value={dayEnd}
                      onChange={(e) => setDayEnd(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Будні (за годину)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                      value={weekdayPrice}
                      onChange={(e) => setWeekdayPrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Вихідні (за годину)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-sm"
                      value={weekendPrice}
                      onChange={(e) => setWeekendPrice(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-[#635bff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5851e6] disabled:opacity-50"
          >
            {saving ? 'Збереження…' : 'Зберегти тариф'}
          </button>
        </form>
      )}
    </div>
  );
}

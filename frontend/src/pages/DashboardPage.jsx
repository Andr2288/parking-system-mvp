import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import { formatDurationHours, formatMoney } from '../utils/format';

export default function DashboardPage() {
  const [allTime, setAllTime] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    let qs = '';
    if (allTime) {
      qs = '?allTime=1';
    } else {
      const f = from.trim().replace('T', ' ');
      const t = to.trim().replace('T', ' ');
      qs = `?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`;
    }
    const res = await api.request(`/api/dashboard${qs}`);
    setData(res);
  }, [allTime, from, to]);

  useEffect(() => {
    let cancelled = false;

    if (!allTime && (!from.trim() || !to.trim())) {
      setLoading(false);
      setError('');
      setData(null);
      return () => {
        cancelled = true;
      };
    }

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
  }, [load, allTime, from, to]);

  const analytics = data?.analytics;
  const spots = data?.spots;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#1a1f36]">Дашборд</h1>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-[#e6ebf1] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm text-[#1a1f36]">
          <input
            type="checkbox"
            checked={allTime}
            onChange={(e) => setAllTime(e.target.checked)}
            className="h-4 w-4 rounded border-[#e6ebf1] text-[#635bff]"
          />
          За ввесь час
        </label>
        {!allTime ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div>
              <label className="text-xs text-[#4f566b]">Від</label>
              <input
                type="datetime-local"
                className="mt-1 block rounded-md border border-[#e6ebf1] px-2 py-1.5 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[#4f566b]">До</label>
              <input
                type="datetime-local"
                className="mt-1 block rounded-md border border-[#e6ebf1] px-2 py-1.5 text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        ) : null}
      </div>

      {!allTime && (!from.trim() || !to.trim()) ? (
        <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Оберіть діапазон «від» і «до», щоб побачити аналітику за період.
        </div>
      ) : loading ? (
        <div className="mt-8 text-[#4f566b]">Завантаження…</div>
      ) : data ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-[#e6ebf1] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-[#635bff]">Місця</p>
            <p className="mt-2 text-3xl font-semibold text-[#1a1f36]">{spots.total}</p>
            <p className="mt-1 text-sm text-[#4f566b]">усього</p>
          </div>
          <div className="rounded-xl border border-[#e6ebf1] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-emerald-700">Вільно</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-800">{spots.free}</p>
          </div>
          <div className="rounded-xl border border-[#e6ebf1] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-red-700">Зайнято</p>
            <p className="mt-2 text-3xl font-semibold text-red-800">{spots.occupied}</p>
          </div>
          <div className="rounded-xl border border-[#e6ebf1] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-[#635bff]">Дохід</p>
            <p className="mt-2 text-2xl font-semibold text-[#1a1f36]">
              {formatMoney(analytics.totalRevenue)}
            </p>
            <p className="mt-1 text-xs text-[#4f566b]">
              {analytics.allTime ? 'за ввесь час' : `${analytics.from} — ${analytics.to}`}
            </p>
          </div>
          <div className="rounded-xl border border-[#e6ebf1] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-[#635bff]">Середній час</p>
            <p className="mt-2 text-2xl font-semibold text-[#1a1f36]">
              {formatDurationHours(analytics.averageParkingHours)}
            </p>
          </div>
          <div className="rounded-xl border border-[#e6ebf1] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-[#635bff]">Макс. час</p>
            <p className="mt-2 text-2xl font-semibold text-[#1a1f36]">
              {formatDurationHours(analytics.maxParkingHours)}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 text-[#4f566b]">Немає даних.</div>
      )}
    </div>
  );
}

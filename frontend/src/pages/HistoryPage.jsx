import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import { formatDateTime, formatMoney, formatTotalHoursDecimal } from '../utils/format';

export default function HistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await api.request('/api/parking-sessions');
    setSessions(data.sessions || []);
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

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1f36]">Історія сесій</h1>
          <p className="text-sm text-[#4f566b]">Завершені сесії, від новіших до старіших.</p>
        </div>
        <button
          type="button"
          onClick={() => load().catch((e) => setError(e.message))}
          className="self-start rounded-md border border-[#e6ebf1] bg-white px-3 py-2 text-sm font-medium"
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
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-[#4f566b]">Немає завершених сесій.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[#e6ebf1] bg-slate-50 text-xs font-semibold uppercase text-[#4f566b]">
                <tr>
                  <th className="px-4 py-3 text-center">Місце</th>
                  <th className="px-4 py-3 text-center">ТЗ</th>
                  <th className="px-4 py-3 text-center">Початок</th>
                  <th className="px-4 py-3 text-center">Кінець</th>
                  <th className="px-4 py-3 text-center">Годин (разом)</th>
                  <th className="px-4 py-3 text-center">Вартість</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ebf1]">
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="flex justify-center">
                        <span className="inline-flex min-h-[1.75rem] items-center justify-center font-mono text-sm font-semibold text-[#1a1f36]">
                          {s.spotNumber}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="flex justify-center">
                        <span className="inline-flex min-h-[1.75rem] max-w-[10rem] items-center justify-center break-words text-sm text-[#4f566b]">
                          {s.licensePlate}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="flex justify-center">
                        <span className="inline-flex min-h-[1.75rem] items-center justify-center text-sm text-[#4f566b]">
                          {formatDateTime(s.startTime)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="flex justify-center">
                        <span className="inline-flex min-h-[1.75rem] items-center justify-center text-sm text-[#4f566b]">
                          {formatDateTime(s.endTime)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="flex justify-center">
                        <span className="inline-flex min-h-[1.75rem] items-center justify-center font-mono text-sm text-[#4f566b]">
                          {formatTotalHoursDecimal(s.durationHours)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className="flex justify-center">
                        <span className="inline-flex min-h-[1.75rem] items-center justify-center font-mono text-sm font-semibold text-[#1a1f36]">
                          {formatMoney(s.totalCost)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

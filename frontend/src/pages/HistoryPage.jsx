import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import { formatDateTime, formatMoney, formatTotalHoursDecimal } from '../utils/format';

export default function HistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    const s = searchQuery.trim();
    if (s) qs.set('search', s);
    if (paymentFilter === 'paid' || paymentFilter === 'unpaid') {
      qs.set('paymentStatus', paymentFilter);
    }
    const q = qs.toString();
    const data = await api.request(`/api/parking-sessions${q ? `?${q}` : ''}`);
    setSessions(data.sessions || []);
  }, [searchQuery, paymentFilter]);

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

  async function handlePaymentChange(sessionId, paymentStatus) {
    setSavingId(sessionId);
    setError('');
    try {
      const data = await api.request(`/api/parking-sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentStatus }),
      });
      setSessions((prev) =>
        prev.map((row) => (row.id === sessionId ? { ...row, ...data.session } : row)),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }

  const hasFilters = Boolean(searchQuery.trim()) || paymentFilter === 'paid' || paymentFilter === 'unpaid';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1a1f36]">Історія сесій</h1>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#e6ebf1] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#e6ebf1] bg-slate-50/50 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[12rem] flex-1 sm:max-w-xs">
            <label htmlFor="history-search" className="text-xs font-medium text-[#4f566b]">
              Пошук
            </label>
            <input
              id="history-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Місце або номер ТЗ…"
              className="mt-1 w-full rounded-md border border-[#e6ebf1] bg-white px-3 py-2 text-sm text-[#1a1f36] placeholder:text-[#94a3b8]"
              autoComplete="off"
            />
          </div>
          <div className="min-w-[10rem] sm:w-48">
            <label htmlFor="history-payment" className="text-xs font-medium text-[#4f566b]">
              Оплата
            </label>
            <select
              id="history-payment"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#e6ebf1] bg-white px-3 py-2 text-sm text-[#1a1f36]"
            >
              <option value="">Усі</option>
              <option value="paid">Оплачено</option>
              <option value="unpaid">Неоплачено</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[#4f566b]">Завантаження…</div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-[#4f566b]">
            {hasFilters ? 'За обраними умовами записів немає.' : 'Немає завершених сесій.'}
          </div>
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
                  <th className="min-w-[9rem] px-4 py-3 text-center">Оплата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ebf1]">
                {sessions.map((s) => {
                  const paid = s.paymentStatus === 'paid';
                  return (
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
                      <td className="px-4 py-3 text-center align-middle">
                        <div className="flex justify-center">
                          <select
                            value={paid ? 'paid' : 'unpaid'}
                            disabled={savingId === s.id}
                            onChange={(e) => handlePaymentChange(s.id, e.target.value)}
                            className={[
                              'max-w-full rounded-md border px-2 py-1.5 text-xs font-semibold',
                              paid
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                : 'border-amber-200 bg-amber-50 text-amber-900',
                              savingId === s.id ? 'opacity-60' : '',
                            ].join(' ')}
                          >
                            <option value="unpaid">Неоплачено</option>
                            <option value="paid">Оплачено</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

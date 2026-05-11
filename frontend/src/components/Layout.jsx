import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as api from '../api/client';
import { useAuth } from '../context/AuthContext';

function navClass({ isActive }) {
  return [
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-[#635bff]/10 text-[#635bff]' : 'text-[#4f566b] hover:bg-slate-100',
  ].join(' ');
}

function periodPillClass(periodKey) {
  switch (periodKey) {
    case 'day':
      return 'border-amber-200 bg-amber-50 text-amber-950';
    case 'night':
      return 'border-slate-300 bg-slate-100 text-slate-900';
    case 'weekday':
      return 'border-sky-200 bg-sky-50 text-sky-950';
    case 'weekend':
      return 'border-violet-200 bg-violet-50 text-violet-950';
    default:
      return 'border-[#e6ebf1] bg-[#f6f9fc] text-[#1a1f36]';
  }
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [live, setLive] = useState(null);
  const [liveError, setLiveError] = useState('');
  const [localNow, setLocalNow] = useState(() => new Date());

  const loadLive = useCallback(async () => {
    try {
      const data = await api.request('/api/tariffs/live');
      setLive(data.live);
      setLiveError('');
    } catch (e) {
      setLive(null);
      setLiveError(e.message || 'Немає даних');
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setLocalNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    loadLive();
    const id = window.setInterval(loadLive, 15_000);
    function onFocus() {
      loadLive();
    }
    window.addEventListener('focus', onFocus);
    function onTariffChanged() {
      loadLive();
    }
    window.addEventListener('parking-tariff-changed', onTariffChanged);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('parking-tariff-changed', onTariffChanged);
    };
  }, [location.pathname, loadLive]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const localTimeLabel = localNow.toLocaleString('uk-UA', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="min-h-screen bg-[#f6f9fc]">
      <header className="border-b border-[#e6ebf1] bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-[#635bff]">
              Паркування MVP
            </span>
            <nav className="flex flex-wrap gap-1">
              <NavLink to="/spots" className={navClass}>
                Місця
              </NavLink>
              <NavLink to="/vehicles" className={navClass}>
                Транспорт
              </NavLink>
              <NavLink to="/tariff" className={navClass}>
                Тариф
              </NavLink>
              <NavLink to="/dashboard" className={navClass}>
                Дашборд
              </NavLink>
              <NavLink to="/history" className={navClass}>
                Історія
              </NavLink>
            </nav>
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-2 sm:border-l sm:border-[#e6ebf1] sm:pl-4">
              {live ? (
                <>
                  <span
                    className={[
                      'inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-1 text-xs font-semibold leading-none',
                      periodPillClass(live.periodKey),
                    ].join(' ')}
                    title={live.mode === 'day_night' && live.dayStart && live.dayEnd ? `День: ${live.dayStart}–${live.dayEnd}` : undefined}
                  >
                    {live.periodLabel}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[#635bff]/25 bg-[#635bff]/8 px-2.5 py-1 text-xs font-semibold leading-none text-[#1a1f36]">
                    {Number(live.ratePerHour).toFixed(2)} ₴/год
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[#e6ebf1] bg-white px-2.5 py-1 text-xs font-semibold leading-none text-[#4f566b]">
                    мін. {Number(live.minPrice).toFixed(2)} ₴
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold leading-none text-amber-900" title={liveError}>
                  {liveError || '…'}
                </span>
              )}
              <span
                className="inline-flex items-center rounded-full border border-[#e6ebf1] bg-[#f8fafc] px-2.5 py-1 font-mono text-xs font-semibold leading-none tabular-nums text-[#64748b]"
                title="Локальний час на вашому пристрої (оновлення щосекунди). День/ніч і ставка — за часом сервера, оновлення ~кожні 15 с або після зміни тарифу / фокусу вікна."
              >
                {localTimeLabel}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <span className="text-[#4f566b]">{user?.login}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-[#e6ebf1] bg-white px-3 py-1.5 font-medium text-[#1a1f36] hover:bg-slate-50"
            >
              Вийти
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

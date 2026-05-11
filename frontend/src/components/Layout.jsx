import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function navClass({ isActive }) {
  return [
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-[#635bff]/10 text-[#635bff]' : 'text-[#4f566b] hover:bg-slate-100',
  ].join(' ');
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[#f6f9fc]">
      <header className="border-b border-[#e6ebf1] bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#635bff]">
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
          </div>
          <div className="flex items-center gap-3 text-sm">
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

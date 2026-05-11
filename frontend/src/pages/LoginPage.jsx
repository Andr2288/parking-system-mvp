import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && user) {
      navigate('/spots', { replace: true });
    }
  }, [ready, user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(loginField.trim(), password);
      navigate('/spots', { replace: true });
    } catch (err) {
      setError(err.message || 'Помилка входу');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f9fc] text-[#4f566b]">
        Завантаження…
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f9fc] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#e6ebf1] bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#635bff]">Адміністратор</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#1a1f36]">Вхід</h1>
        <p className="mt-2 text-sm text-[#4f566b]">Введіть логін і пароль для доступу до системи.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-[#1a1f36]" htmlFor="login">
              Логін
            </label>
            <input
              id="login"
              autoComplete="username"
              className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-[#1a1f36] outline-none ring-[#635bff] focus:ring-2"
              value={loginField}
              onChange={(e) => setLoginField(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1f36]" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-[#e6ebf1] px-3 py-2 text-[#1a1f36] outline-none ring-[#635bff] focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-[#635bff] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#5851e6] disabled:opacity-60"
          >
            {submitting ? 'Вхід…' : 'Увійти'}
          </button>
        </form>
      </div>
    </div>
  );
}

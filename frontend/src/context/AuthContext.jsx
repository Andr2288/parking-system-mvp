import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!api.getToken()) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const data = await api.request('/api/auth/me');
        if (!cancelled) setUser(data.user);
      } catch {
        api.clearToken();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (login, password) => {
    const data = await api.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    api.setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    api.clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

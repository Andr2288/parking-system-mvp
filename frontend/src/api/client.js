const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function buildUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE) return p;
  return `${API_BASE}${p}`;
}

const TOKEN_KEY = 'parking_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path), { ...options, headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Некоректна відповідь сервера' };
  }

  if (!res.ok) {
    const msg = data?.error;
    const err = new Error(typeof msg === 'string' ? msg : 'Помилка запиту');
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

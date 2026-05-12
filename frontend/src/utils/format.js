export function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(2)} ₴`;
}

export function formatDateTime(value) {
  if (value == null) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('uk-UA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDurationHours(value) {
  if (value == null) return '—';
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '—';
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  if (h === 0) return `${m} хв`;
  return `${h} год ${m} хв`;
}

/** Десяткові години для таблиць (uk-UA). */
export function formatTotalHoursDecimal(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '—';
  return `${n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} год`;
}

function parseTimeToMinutes(value) {
  if (value == null) return 8 * 60;
  const str = String(value);
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 8 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isDayAtLocal(date, dayStartMin, dayEndMin) {
  const m = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 1000;
  if (dayStartMin < dayEndMin) {
    return m >= dayStartMin && m < dayEndMin;
  }
  return m >= dayStartMin || m < dayEndMin;
}

function isWeekendAtLocal(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function accumulateByHourSegments(start, end, classify) {
  let a = 0;
  let b = 0;
  const t = new Date(start.getTime());
  const endMs = end.getTime();

  while (t.getTime() < endMs) {
    const nextHour = new Date(t);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    const boundaryMs = Math.min(nextHour.getTime(), endMs);
    const mins = (boundaryMs - t.getTime()) / 60000;
    const bucket = classify(t);
    if (bucket === 'a') a += mins;
    else b += mins;
    t.setTime(boundaryMs);
  }

  return { a, b };
}

function computeBasicCost(start, end, tariff) {
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  const hours = Math.ceil(ms / (3600 * 1000));
  const raw = hours * Number(tariff.price_per_hour);
  return Math.max(Number(tariff.min_price), raw);
}

function computeDayNightCost(start, end, tariff) {
  const dayStartMin = parseTimeToMinutes(tariff.day_start);
  const dayEndMin = parseTimeToMinutes(tariff.day_end);
  const { a: dayMin, b: nightMin } = accumulateByHourSegments(start, end, (d) =>
    isDayAtLocal(d, dayStartMin, dayEndMin) ? 'a' : 'b'
  );
  const dayHours = Math.ceil(dayMin / 60);
  const nightHours = Math.ceil(nightMin / 60);
  const raw =
    dayHours * Number(tariff.day_price || 0) + nightHours * Number(tariff.night_price || 0);
  return Math.max(Number(tariff.min_price), raw);
}

function computeWeekdayWeekendCost(start, end, tariff) {
  const { a: wdMin, b: weMin } = accumulateByHourSegments(start, end, (d) =>
    isWeekendAtLocal(d) ? 'b' : 'a'
  );
  const wdHours = Math.ceil(wdMin / 60);
  const weHours = Math.ceil(weMin / 60);
  const raw =
    wdHours * Number(tariff.weekday_price || 0) + weHours * Number(tariff.weekend_price || 0);
  return Math.max(Number(tariff.min_price), raw);
}

function computeSessionCost(start, end, tariff) {
  if (!start || !end || end <= start) {
    return 0;
  }

  if (!tariff.smart_mode) {
    return computeBasicCost(start, end, tariff);
  }

  if (tariff.smart_type === 'day_night') {
    return computeDayNightCost(start, end, tariff);
  }

  if (tariff.smart_type === 'weekday_weekend') {
    return computeWeekdayWeekendCost(start, end, tariff);
  }

  return computeBasicCost(start, end, tariff);
}

function getLiveTariffContext(tariff, now = new Date()) {
  const minPrice = Number(tariff.min_price);
  const baseRate = Number(tariff.price_per_hour);
  const safeMin = Number.isFinite(minPrice) ? minPrice : 0;
  const safeBase = Number.isFinite(baseRate) ? baseRate : 0;

  if (!tariff.smart_mode) {
    return {
      serverTime: now.toISOString(),
      mode: 'basic',
      periodKey: 'base',
      periodLabel: 'Базовий тариф',
      ratePerHour: safeBase,
      minPrice: safeMin,
    };
  }

  if (tariff.smart_type === 'day_night') {
    const dayStartMin = parseTimeToMinutes(tariff.day_start);
    const dayEndMin = parseTimeToMinutes(tariff.day_end);
    const isDay = isDayAtLocal(now, dayStartMin, dayEndMin);
    const dayP = Number(tariff.day_price);
    const nightP = Number(tariff.night_price);
    const rate = isDay
      ? Number.isFinite(dayP)
        ? dayP
        : safeBase
      : Number.isFinite(nightP)
        ? nightP
        : safeBase;
    return {
      serverTime: now.toISOString(),
      mode: 'day_night',
      periodKey: isDay ? 'day' : 'night',
      periodLabel: isDay ? 'День' : 'Ніч',
      ratePerHour: Number.isFinite(rate) ? rate : safeBase,
      minPrice: safeMin,
      dayStart: tariff.day_start,
      dayEnd: tariff.day_end,
    };
  }

  if (tariff.smart_type === 'weekday_weekend') {
    const weekend = isWeekendAtLocal(now);
    const wdP = Number(tariff.weekday_price);
    const weP = Number(tariff.weekend_price);
    const rate = weekend
      ? Number.isFinite(weP)
        ? weP
        : safeBase
      : Number.isFinite(wdP)
        ? wdP
        : safeBase;
    return {
      serverTime: now.toISOString(),
      mode: 'weekday_weekend',
      periodKey: weekend ? 'weekend' : 'weekday',
      periodLabel: weekend ? 'Вихідний' : 'Будень',
      ratePerHour: Number.isFinite(rate) ? rate : safeBase,
      minPrice: safeMin,
    };
  }

  return {
    serverTime: now.toISOString(),
    mode: 'basic',
    periodKey: 'base',
    periodLabel: 'Базовий тариф',
    ratePerHour: safeBase,
    minPrice: safeMin,
  };
}

module.exports = { computeSessionCost, getLiveTariffContext };

/**
 * Parking cost by tariff rules (MVP).
 * Basic: billable hours = ceil(duration / 1h), cost = max(min_price, hours * price_per_hour).
 * Smart day/night: split duration into day vs night minutes (local wall clock), ceil each to hours, multiply by rates, then max(min_price, sum).
 * Smart weekday/weekend: same with weekday vs Sat/Sun minutes.
 */

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

/**
 * @param {Date} start
 * @param {Date} end
 * @param {object} tariff - row from tariffs table
 * @returns {number}
 */
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

module.exports = { computeSessionCost };

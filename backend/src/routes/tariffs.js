const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getLiveTariffContext } = require('../services/pricing');

const router = express.Router();

router.use(requireAuth);

function mapTariffRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    isActive: Boolean(row.is_active),
    smartMode: Boolean(row.smart_mode),
    smartType: row.smart_type,
    pricePerHour: Number(row.price_per_hour),
    minPrice: Number(row.min_price),
    dayPrice: row.day_price != null ? Number(row.day_price) : null,
    nightPrice: row.night_price != null ? Number(row.night_price) : null,
    weekdayPrice: row.weekday_price != null ? Number(row.weekday_price) : null,
    weekendPrice: row.weekend_price != null ? Number(row.weekend_price) : null,
    dayStart: row.day_start,
    dayEnd: row.day_end,
    createdAt: row.created_at,
  };
}

router.get('/live', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM tariffs WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'No active tariff' });
      return;
    }
    const live = getLiveTariffContext(rows[0], new Date());
    res.json({ live });
  } catch (err) {
    console.error('Get live tariff:', err.message);
    res.status(500).json({ error: 'Failed to load live tariff context' });
  }
});

router.get('/current', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM tariffs WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'No active tariff' });
      return;
    }
    res.json({ tariff: mapTariffRow(rows[0]) });
  } catch (err) {
    console.error('Get tariff:', err.message);
    res.status(500).json({ error: 'Failed to load tariff' });
  }
});

router.put('/current', async (req, res) => {
  const body = req.body || {};
  const pricePerHour = Number(body.pricePerHour);
  const minPrice = Number(body.minPrice);
  const smartMode = Boolean(body.smartMode);
  const smartType = body.smartType === 'day_night' || body.smartType === 'weekday_weekend' ? body.smartType : null;

  if (!Number.isFinite(pricePerHour) || pricePerHour < 0) {
    res.status(400).json({ error: 'pricePerHour must be a non-negative number' });
    return;
  }
  if (!Number.isFinite(minPrice) || minPrice < 0) {
    res.status(400).json({ error: 'minPrice must be a non-negative number' });
    return;
  }

  let dayPrice = body.dayPrice != null ? Number(body.dayPrice) : null;
  let nightPrice = body.nightPrice != null ? Number(body.nightPrice) : null;
  let weekdayPrice = body.weekdayPrice != null ? Number(body.weekdayPrice) : null;
  let weekendPrice = body.weekendPrice != null ? Number(body.weekendPrice) : null;
  let dayStart = body.dayStart != null ? String(body.dayStart).trim() : null;
  let dayEnd = body.dayEnd != null ? String(body.dayEnd).trim() : null;

  if (smartMode) {
    if (!smartType) {
      res.status(400).json({ error: 'smartType is required when smartMode is true' });
      return;
    }
    if (smartType === 'day_night') {
      if (!Number.isFinite(dayPrice) || dayPrice < 0 || !Number.isFinite(nightPrice) || nightPrice < 0) {
        res.status(400).json({ error: 'dayPrice and nightPrice are required for day/night mode' });
        return;
      }
      if (!dayStart || !dayEnd) {
        res.status(400).json({ error: 'dayStart and dayEnd are required for day/night mode' });
        return;
      }
      weekdayPrice = null;
      weekendPrice = null;
    } else if (smartType === 'weekday_weekend') {
      if (!Number.isFinite(weekdayPrice) || weekdayPrice < 0 || !Number.isFinite(weekendPrice) || weekendPrice < 0) {
        res.status(400).json({ error: 'weekdayPrice and weekendPrice are required for weekday/weekend mode' });
        return;
      }
      dayPrice = null;
      nightPrice = null;
      dayStart = null;
      dayEnd = null;
    }
  } else {
    dayPrice = null;
    nightPrice = null;
    weekdayPrice = null;
    weekendPrice = null;
    dayStart = null;
    dayEnd = null;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE tariffs SET is_active = 0 WHERE is_active = 1');
    const [result] = await conn.query(
      `INSERT INTO tariffs (
        is_active, smart_mode, smart_type, price_per_hour, min_price,
        day_price, night_price, weekday_price, weekend_price, day_start, day_end
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        smartMode ? 1 : 0,
        smartMode ? smartType : null,
        pricePerHour,
        minPrice,
        dayPrice,
        nightPrice,
        weekdayPrice,
        weekendPrice,
        dayStart,
        dayEnd,
      ]
    );
    const [rows] = await conn.query('SELECT * FROM tariffs WHERE id = ?', [result.insertId]);
    await conn.commit();
    res.json({ tariff: mapTariffRow(rows[0]) });
  } catch (err) {
    await conn.rollback();
    console.error('Update tariff:', err.message);
    res.status(500).json({ error: 'Failed to update tariff' });
  } finally {
    conn.release();
  }
});

module.exports = router;

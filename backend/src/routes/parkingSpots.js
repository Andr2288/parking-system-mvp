const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

function normalizeZoneColor(value) {
  if (value == null || value === '') {
    return { ok: true, color: null };
  }
  const s = String(value).trim();
  if (!/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(s)) {
    return { ok: false, error: 'Колір зони: формат #RGB або #RRGGBB (наприклад #22c55e)' };
  }
  return { ok: true, color: s };
}

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         p.id,
         p.spot_number AS spotNumber,
         p.status,
         p.zone,
         p.note,
         p.price_coefficient AS priceCoefficient,
         p.zone_color AS zoneColor,
         ps.id AS activeSessionId,
         ps.start_time AS activeSessionStartTime
       FROM parking_spots p
       LEFT JOIN parking_sessions ps
         ON ps.parking_spot_id = p.id AND ps.status = 'active'
       ORDER BY p.spot_number ASC`
    );
    res.json({ spots: rows });
  } catch (err) {
    console.error('List spots:', err.message);
    res.status(500).json({ error: 'Failed to load parking spots' });
  }
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid parking spot id' });
    return;
  }

  const body = req.body || {};
  const hasAny =
    body.zone !== undefined ||
    body.note !== undefined ||
    body.priceCoefficient !== undefined ||
    body.zoneColor !== undefined;

  if (!hasAny) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  const fields = [];
  const values = [];

  if (body.zone !== undefined) {
    const z = typeof body.zone === 'string' ? body.zone.trim() : '';
    fields.push('zone = ?');
    values.push(z || null);
  }
  if (body.note !== undefined) {
    const n = typeof body.note === 'string' ? body.note.trim() : '';
    fields.push('note = ?');
    values.push(n || null);
  }
  if (body.priceCoefficient !== undefined) {
    const c = Number(body.priceCoefficient);
    if (!Number.isFinite(c) || c <= 0 || c > 10) {
      res.status(400).json({ error: 'priceCoefficient must be a number between 0.01 and 10' });
      return;
    }
    fields.push('price_coefficient = ?');
    values.push(c);
  }
  if (body.zoneColor !== undefined) {
    const parsed = normalizeZoneColor(body.zoneColor);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    fields.push('zone_color = ?');
    values.push(parsed.color);
  }

  values.push(id);

  try {
    const [result] = await pool.query(
      `UPDATE parking_spots SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Parking spot not found' });
      return;
    }

    const [rows] = await pool.query(
      `SELECT
         p.id,
         p.spot_number AS spotNumber,
         p.status,
         p.zone,
         p.note,
         p.price_coefficient AS priceCoefficient,
         p.zone_color AS zoneColor,
         ps.id AS activeSessionId,
         ps.start_time AS activeSessionStartTime
       FROM parking_spots p
       LEFT JOIN parking_sessions ps
         ON ps.parking_spot_id = p.id AND ps.status = 'active'
       WHERE p.id = ?
       LIMIT 1`,
      [id]
    );

    res.json({ spot: rows[0] });
  } catch (err) {
    console.error('Update spot:', err.message);
    res.status(500).json({ error: 'Failed to update parking spot' });
  }
});

module.exports = router;

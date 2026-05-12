const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

async function selectSpotById(id) {
  const [rows] = await pool.query(
    `SELECT
       p.id,
       p.spot_number AS spotNumber,
       p.status,
       p.zone,
       p.note,
       p.price_coefficient AS priceCoefficient,
       ps.id AS activeSessionId,
       ps.start_time AS activeSessionStartTime
     FROM parking_spots p
     LEFT JOIN parking_sessions ps
       ON ps.parking_spot_id = p.id AND ps.status = 'active'
     WHERE p.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
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

router.post('/', async (req, res) => {
  const body = req.body || {};
  const spotNumber = typeof body.spotNumber === 'string' ? body.spotNumber.trim() : '';
  if (!spotNumber || spotNumber.length > 20) {
    res.status(400).json({ error: 'Вкажіть номер місця (1–20 символів)' });
    return;
  }

  const zone = typeof body.zone === 'string' ? body.zone.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const coeffRaw = body.priceCoefficient !== undefined ? Number(body.priceCoefficient) : 1;
  if (!Number.isFinite(coeffRaw) || coeffRaw <= 0 || coeffRaw > 10) {
    res.status(400).json({ error: 'priceCoefficient must be a number between 0.01 and 10' });
    return;
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO parking_spots (spot_number, status, zone, note, price_coefficient)
       VALUES (?, 'free', ?, ?, ?)`,
      [spotNumber, zone || null, note || null, coeffRaw]
    );
    const spot = await selectSpotById(result.insertId);
    res.status(201).json({ spot });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Місце з таким номером уже існує' });
      return;
    }
    console.error('Create spot:', err.message);
    res.status(500).json({ error: 'Failed to create parking spot' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid parking spot id' });
    return;
  }

  try {
    const [spots] = await pool.query(
      `SELECT id, status FROM parking_spots WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!spots.length) {
      res.status(404).json({ error: 'Parking spot not found' });
      return;
    }
    if (spots[0].status === 'occupied') {
      res.status(409).json({ error: 'Спочатку звільніть місце (закіньте активну сесію).' });
      return;
    }

    const [cntRows] = await pool.query(
      `SELECT COUNT(*) AS c FROM parking_sessions WHERE parking_spot_id = ?`,
      [id]
    );
    if (Number(cntRows[0]?.c || 0) > 0) {
      res
        .status(409)
        .json({ error: 'Неможливо видалити місце: для нього є записані парковочні сесії.' });
      return;
    }

    const [del] = await pool.query(`DELETE FROM parking_spots WHERE id = ?`, [id]);
    if (del.affectedRows === 0) {
      res.status(404).json({ error: 'Parking spot not found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    console.error('Delete spot:', err.message);
    res.status(500).json({ error: 'Failed to delete parking spot' });
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
    body.priceCoefficient !== undefined;

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

    const spot = await selectSpotById(id);
    res.json({ spot });
  } catch (err) {
    console.error('Update spot:', err.message);
    res.status(500).json({ error: 'Failed to update parking spot' });
  }
});

module.exports = router;

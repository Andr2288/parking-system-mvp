const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { computeSessionCost } = require('../services/pricing');

const router = express.Router();

router.use(requireAuth);

async function getActiveTariff(conn) {
  const [rows] = await conn.query(
    'SELECT * FROM tariffs WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
  );
  return rows[0] || null;
}

function toNullableNumber(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveRateSnapshots(tariff) {
  const base = toNullableNumber(tariff.price_per_hour);
  if (tariff.smart_mode && tariff.smart_type === 'day_night') {
    return {
      day: toNullableNumber(tariff.day_price) ?? base,
      night: toNullableNumber(tariff.night_price) ?? base,
    };
  }
  if (tariff.smart_mode && tariff.smart_type === 'weekday_weekend') {
    return {
      day: toNullableNumber(tariff.weekday_price) ?? base,
      night: toNullableNumber(tariff.weekend_price) ?? base,
    };
  }
  return { day: base, night: base };
}

router.post('/', async (req, res) => {
  const spotId = Number(req.body?.parkingSpotId);
  const vehicleId = Number(req.body?.vehicleId);

  if (!Number.isInteger(spotId) || spotId < 1 || !Number.isInteger(vehicleId) || vehicleId < 1) {
    res.status(400).json({ error: 'parkingSpotId and vehicleId are required' });
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [vehicles] = await conn.query(
      'SELECT id FROM vehicles WHERE id = ? LIMIT 1',
      [vehicleId]
    );
    if (vehicles.length === 0) {
      await conn.rollback();
      res.status(400).json({ error: 'Vehicle not found' });
      return;
    }

    const [activeForVehicle] = await conn.query(
      'SELECT id FROM parking_sessions WHERE vehicle_id = ? AND status = ? LIMIT 1',
      [vehicleId, 'active']
    );
    if (activeForVehicle.length > 0) {
      await conn.rollback();
      res.status(400).json({ error: 'This vehicle already has an active parking session' });
      return;
    }

    const [spots] = await conn.query(
      'SELECT id, status FROM parking_spots WHERE id = ? FOR UPDATE',
      [spotId]
    );
    if (spots.length === 0) {
      await conn.rollback();
      res.status(404).json({ error: 'Parking spot not found' });
      return;
    }
    if (spots[0].status !== 'free') {
      await conn.rollback();
      res.status(400).json({ error: 'Parking spot is already occupied' });
      return;
    }

    const tariff = await getActiveTariff(conn);
    if (!tariff) {
      await conn.rollback();
      res.status(500).json({ error: 'No active tariff configured' });
      return;
    }

    const { day: dayRateSnapshot, night: nightRateSnapshot } = resolveRateSnapshots(tariff);
    const [result] = await conn.query(
      `INSERT INTO parking_sessions (
         parking_spot_id, vehicle_id, start_time, status, tariff_id, day_rate_snapshot, night_rate_snapshot
       )
       VALUES (?, ?, NOW(), 'active', ?, ?, ?)`,
      [spotId, vehicleId, tariff.id, dayRateSnapshot, nightRateSnapshot]
    );

    await conn.query('UPDATE parking_spots SET status = ? WHERE id = ?', ['occupied', spotId]);

    await conn.commit();

    const [rows] = await pool.query(
      `SELECT
         ps.id,
         ps.parking_spot_id AS parkingSpotId,
         ps.vehicle_id AS vehicleId,
         ps.start_time AS startTime,
         ps.end_time AS endTime,
         ps.total_cost AS totalCost,
         ps.status,
         ps.payment_status AS paymentStatus,
         COALESCE(ps.day_rate_snapshot, CASE
           WHEN t.smart_mode = 1 AND t.smart_type = 'day_night' THEN t.day_price
           WHEN t.smart_mode = 1 AND t.smart_type = 'weekday_weekend' THEN t.weekday_price
           ELSE t.price_per_hour
         END) AS dayRateSnapshot,
         COALESCE(ps.night_rate_snapshot, CASE
           WHEN t.smart_mode = 1 AND t.smart_type = 'day_night' THEN t.night_price
           WHEN t.smart_mode = 1 AND t.smart_type = 'weekday_weekend' THEN t.weekend_price
           ELSE t.price_per_hour
         END) AS nightRateSnapshot,
         ps.tariff_id AS tariffId,
         p.spot_number AS spotNumber,
         v.license_plate AS licensePlate
       FROM parking_sessions ps
       JOIN parking_spots p ON p.id = ps.parking_spot_id
       JOIN vehicles v ON v.id = ps.vehicle_id
       JOIN tariffs t ON t.id = ps.tariff_id
       WHERE ps.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ session: rows[0] });
  } catch (err) {
    await conn.rollback();
    console.error('Start session:', err.message);
    res.status(500).json({ error: 'Failed to start parking session' });
  } finally {
    conn.release();
  }
});

router.post('/:id/end', async (req, res) => {
  const sessionId = Number(req.params.id);
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    res.status(400).json({ error: 'Invalid session id' });
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [sessions] = await conn.query(
      `SELECT ps.*,
              p.spot_number AS spotNumber,
              p.price_coefficient AS spotPriceCoefficient,
              v.license_plate AS licensePlate
       FROM parking_sessions ps
       JOIN parking_spots p ON p.id = ps.parking_spot_id
       JOIN vehicles v ON v.id = ps.vehicle_id
       WHERE ps.id = ?
       FOR UPDATE`,
      [sessionId]
    );

    if (sessions.length === 0) {
      await conn.rollback();
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const session = sessions[0];
    if (session.status !== 'active') {
      await conn.rollback();
      res.status(400).json({ error: 'Session is already completed' });
      return;
    }

    const [tariffRows] = await conn.query('SELECT * FROM tariffs WHERE id = ? LIMIT 1', [
      session.tariff_id,
    ]);
    const tariff = tariffRows[0];
    if (!tariff) {
      await conn.rollback();
      res.status(500).json({ error: 'Tariff for this session is missing' });
      return;
    }

    const [nowRows] = await conn.query('SELECT NOW() AS end_time');
    const endTime = nowRows[0].end_time;
    const startTime = session.start_time instanceof Date ? session.start_time : new Date(session.start_time);

    let totalCost = computeSessionCost(startTime, endTime, tariff);
    const coeff = Number(session.spotPriceCoefficient);
    const k = Number.isFinite(coeff) && coeff > 0 ? coeff : 1;
    totalCost = Math.round(totalCost * k * 100) / 100;

    await conn.query(
      `UPDATE parking_sessions
       SET end_time = ?, total_cost = ?, status = 'completed'
       WHERE id = ?`,
      [endTime, totalCost, sessionId]
    );

    await conn.query('UPDATE parking_spots SET status = ? WHERE id = ?', [
      'free',
      session.parking_spot_id,
    ]);

    await conn.commit();

    const [out] = await pool.query(
      `SELECT
         ps.id,
         ps.parking_spot_id AS parkingSpotId,
         ps.vehicle_id AS vehicleId,
         ps.start_time AS startTime,
         ps.end_time AS endTime,
         ps.total_cost AS totalCost,
         ps.status,
         ps.payment_status AS paymentStatus,
         COALESCE(ps.day_rate_snapshot, CASE
           WHEN t.smart_mode = 1 AND t.smart_type = 'day_night' THEN t.day_price
           WHEN t.smart_mode = 1 AND t.smart_type = 'weekday_weekend' THEN t.weekday_price
           ELSE t.price_per_hour
         END) AS dayRateSnapshot,
         COALESCE(ps.night_rate_snapshot, CASE
           WHEN t.smart_mode = 1 AND t.smart_type = 'day_night' THEN t.night_price
           WHEN t.smart_mode = 1 AND t.smart_type = 'weekday_weekend' THEN t.weekend_price
           ELSE t.price_per_hour
         END) AS nightRateSnapshot,
         p.spot_number AS spotNumber,
         v.license_plate AS licensePlate
       FROM parking_sessions ps
       JOIN parking_spots p ON p.id = ps.parking_spot_id
       JOIN vehicles v ON v.id = ps.vehicle_id
       JOIN tariffs t ON t.id = ps.tariff_id
       WHERE ps.id = ?`,
      [sessionId]
    );

    res.json({ session: out[0] });
  } catch (err) {
    await conn.rollback();
    console.error('End session:', err.message);
    res.status(500).json({ error: 'Failed to end parking session' });
  } finally {
    conn.release();
  }
});

router.patch('/:id', async (req, res) => {
  const sessionId = Number(req.params.id);
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    res.status(400).json({ error: 'Invalid session id' });
    return;
  }

  const raw = req.body?.paymentStatus;
  const paymentStatus = typeof raw === 'string' ? raw.trim() : '';
  if (paymentStatus !== 'paid' && paymentStatus !== 'unpaid') {
    res.status(400).json({ error: 'paymentStatus must be "paid" or "unpaid"' });
    return;
  }

  try {
    const [result] = await pool.query(
      `UPDATE parking_sessions SET payment_status = ? WHERE id = ? AND status = 'completed'`,
      [paymentStatus, sessionId]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Завершену сесію не знайдено' });
      return;
    }

    const [rows] = await pool.query(
      `SELECT
         ps.id,
         ps.parking_spot_id AS parkingSpotId,
         ps.vehicle_id AS vehicleId,
         ps.start_time AS startTime,
         ps.end_time AS endTime,
         ps.total_cost AS totalCost,
         ps.status,
         ps.payment_status AS paymentStatus,
         COALESCE(ps.day_rate_snapshot, CASE
           WHEN t.smart_mode = 1 AND t.smart_type = 'day_night' THEN t.day_price
           WHEN t.smart_mode = 1 AND t.smart_type = 'weekday_weekend' THEN t.weekday_price
           ELSE t.price_per_hour
         END) AS dayRateSnapshot,
         COALESCE(ps.night_rate_snapshot, CASE
           WHEN t.smart_mode = 1 AND t.smart_type = 'day_night' THEN t.night_price
           WHEN t.smart_mode = 1 AND t.smart_type = 'weekday_weekend' THEN t.weekend_price
           ELSE t.price_per_hour
         END) AS nightRateSnapshot,
         p.spot_number AS spotNumber,
         v.license_plate AS licensePlate,
         ROUND(TIMESTAMPDIFF(SECOND, ps.start_time, ps.end_time) / 3600, 4) AS durationHours
       FROM parking_sessions ps
       JOIN parking_spots p ON p.id = ps.parking_spot_id
       JOIN vehicles v ON v.id = ps.vehicle_id
       JOIN tariffs t ON t.id = ps.tariff_id
       WHERE ps.id = ?`,
      [sessionId]
    );
    res.json({ session: rows[0] });
  } catch (err) {
    console.error('Update session payment:', err.message);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

router.get('/', async (req, res) => {
  const search =
    typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const paymentFilter =
    typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus.trim() : '';

  let sql = `
      SELECT
         ps.id,
         ps.parking_spot_id AS parkingSpotId,
         ps.vehicle_id AS vehicleId,
         ps.start_time AS startTime,
         ps.end_time AS endTime,
         ps.total_cost AS totalCost,
         ps.status,
         ps.payment_status AS paymentStatus,
         COALESCE(ps.day_rate_snapshot, CASE
           WHEN t.smart_mode = 1 AND t.smart_type = 'day_night' THEN t.day_price
           WHEN t.smart_mode = 1 AND t.smart_type = 'weekday_weekend' THEN t.weekday_price
           ELSE t.price_per_hour
         END) AS dayRateSnapshot,
         COALESCE(ps.night_rate_snapshot, CASE
           WHEN t.smart_mode = 1 AND t.smart_type = 'day_night' THEN t.night_price
           WHEN t.smart_mode = 1 AND t.smart_type = 'weekday_weekend' THEN t.weekend_price
           ELSE t.price_per_hour
         END) AS nightRateSnapshot,
         p.spot_number AS spotNumber,
         v.license_plate AS licensePlate,
         ROUND(TIMESTAMPDIFF(SECOND, ps.start_time, ps.end_time) / 3600, 4) AS durationHours
       FROM parking_sessions ps
       JOIN parking_spots p ON p.id = ps.parking_spot_id
       JOIN vehicles v ON v.id = ps.vehicle_id
       JOIN tariffs t ON t.id = ps.tariff_id
       WHERE ps.status = 'completed'`;
  const params = [];

  if (paymentFilter === 'paid' || paymentFilter === 'unpaid') {
    sql += ' AND ps.payment_status = ?';
    params.push(paymentFilter);
  }

  if (search) {
    sql += ' AND (p.spot_number LIKE ? OR v.license_plate LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like);
  }

  sql += ' ORDER BY ps.end_time DESC, ps.id DESC';

  try {
    const [rows] = await pool.query(sql, params);
    res.json({ sessions: rows });
  } catch (err) {
    console.error('Session history:', err.message);
    res.status(500).json({ error: 'Failed to load session history' });
  }
});

module.exports = router;

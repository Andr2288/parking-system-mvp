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
      'SELECT id FROM vehicles WHERE id = ? AND is_archived = 0 LIMIT 1',
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

    const [result] = await conn.query(
      `INSERT INTO parking_sessions (parking_spot_id, vehicle_id, start_time, status, tariff_id)
       VALUES (?, ?, NOW(), 'active', ?)`,
      [spotId, vehicleId, tariff.id]
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
         ps.tariff_id AS tariffId,
         p.spot_number AS spotNumber,
         v.license_plate AS licensePlate
       FROM parking_sessions ps
       JOIN parking_spots p ON p.id = ps.parking_spot_id
       JOIN vehicles v ON v.id = ps.vehicle_id
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
      `SELECT ps.*, p.spot_number AS spotNumber, v.license_plate AS licensePlate
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

    const totalCost = computeSessionCost(startTime, endTime, tariff);

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
         p.spot_number AS spotNumber,
         v.license_plate AS licensePlate
       FROM parking_sessions ps
       JOIN parking_spots p ON p.id = ps.parking_spot_id
       JOIN vehicles v ON v.id = ps.vehicle_id
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

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         ps.id,
         ps.parking_spot_id AS parkingSpotId,
         ps.vehicle_id AS vehicleId,
         ps.start_time AS startTime,
         ps.end_time AS endTime,
         ps.total_cost AS totalCost,
         ps.status,
         p.spot_number AS spotNumber,
         v.license_plate AS licensePlate
       FROM parking_sessions ps
       JOIN parking_spots p ON p.id = ps.parking_spot_id
       JOIN vehicles v ON v.id = ps.vehicle_id
       WHERE ps.status = 'completed'
       ORDER BY ps.end_time DESC, ps.id DESC`
    );
    res.json({ sessions: rows });
  } catch (err) {
    console.error('Session history:', err.message);
    res.status(500).json({ error: 'Failed to load session history' });
  }
});

module.exports = router;

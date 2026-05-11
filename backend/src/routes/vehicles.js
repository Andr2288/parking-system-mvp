const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         v.id,
         v.license_plate AS licensePlate,
         v.brand,
         v.vehicle_type AS vehicleType,
         EXISTS(
           SELECT 1 FROM parking_sessions ps
           WHERE ps.vehicle_id = v.id AND ps.status = 'active'
         ) AS onParking
       FROM vehicles v
       WHERE v.is_archived = 0
       ORDER BY v.license_plate ASC`
    );
    res.json({ vehicles: rows });
  } catch (err) {
    console.error('List vehicles:', err.message);
    res.status(500).json({ error: 'Failed to load vehicles' });
  }
});

router.post('/', async (req, res) => {
  const plateRaw = typeof req.body?.licensePlate === 'string' ? req.body.licensePlate.trim() : '';
  if (!plateRaw) {
    res.status(400).json({ error: 'License plate is required' });
    return;
  }

  const brand = typeof req.body?.brand === 'string' ? req.body.brand.trim() || null : null;
  const vehicleType =
    typeof req.body?.vehicleType === 'string' ? req.body.vehicleType.trim() || null : null;

  try {
    const [result] = await pool.query(
      'INSERT INTO vehicles (license_plate, brand, vehicle_type) VALUES (?, ?, ?)',
      [plateRaw, brand, vehicleType]
    );
    const [rows] = await pool.query(
      `SELECT id, license_plate AS licensePlate, brand, vehicle_type AS vehicleType,
              0 AS onParking
       FROM vehicles WHERE id = ?`,
      [result.insertId]
    );
    res.status(201).json({ vehicle: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Vehicle with this license plate already exists' });
      return;
    }
    console.error('Create vehicle:', err.message);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid vehicle id' });
    return;
  }

  const plateRaw =
    typeof req.body?.licensePlate === 'string' ? req.body.licensePlate.trim() : undefined;
  const brand = typeof req.body?.brand === 'string' ? req.body.brand.trim() || null : undefined;
  const vehicleType =
    typeof req.body?.vehicleType === 'string' ? req.body.vehicleType.trim() || null : undefined;

  if (plateRaw === undefined && brand === undefined && vehicleType === undefined) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  try {
    const [existing] = await pool.query('SELECT id FROM vehicles WHERE id = ? AND is_archived = 0', [
      id,
    ]);
    if (existing.length === 0) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    const [active] = await pool.query(
      'SELECT id FROM parking_sessions WHERE vehicle_id = ? AND status = ? LIMIT 1',
      [id, 'active']
    );
    if (active.length > 0 && plateRaw !== undefined) {
      res.status(400).json({ error: 'Cannot change license plate while vehicle has an active session' });
      return;
    }

    const fields = [];
    const values = [];
    if (plateRaw !== undefined) {
      fields.push('license_plate = ?');
      values.push(plateRaw);
    }
    if (brand !== undefined) {
      fields.push('brand = ?');
      values.push(brand);
    }
    if (vehicleType !== undefined) {
      fields.push('vehicle_type = ?');
      values.push(vehicleType);
    }
    values.push(id);

    await pool.query(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.query(
      `SELECT v.id, v.license_plate AS licensePlate, v.brand, v.vehicle_type AS vehicleType,
              EXISTS(SELECT 1 FROM parking_sessions ps WHERE ps.vehicle_id = v.id AND ps.status = 'active') AS onParking
       FROM vehicles v WHERE v.id = ?`,
      [id]
    );
    res.json({ vehicle: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Vehicle with this license plate already exists' });
      return;
    }
    console.error('Update vehicle:', err.message);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid vehicle id' });
    return;
  }

  try {
    const [active] = await pool.query(
      'SELECT id FROM parking_sessions WHERE vehicle_id = ? AND status = ? LIMIT 1',
      [id, 'active']
    );
    if (active.length > 0) {
      res.status(400).json({ error: 'Cannot delete vehicle with an active parking session' });
      return;
    }

    const [updated] = await pool.query(
      'UPDATE vehicles SET is_archived = 1 WHERE id = ? AND is_archived = 0',
      [id]
    );
    if (updated.affectedRows === 0) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete vehicle:', err.message);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

module.exports = router;

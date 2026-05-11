const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         p.id,
         p.spot_number AS spotNumber,
         p.status,
         p.zone,
         p.note,
         ps.id AS activeSessionId
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

module.exports = router;

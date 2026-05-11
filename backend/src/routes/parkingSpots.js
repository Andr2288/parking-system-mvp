const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, spot_number AS spotNumber, status, zone, note
       FROM parking_spots
       ORDER BY spot_number ASC`
    );
    res.json({ spots: rows });
  } catch (err) {
    console.error('List spots:', err.message);
    res.status(500).json({ error: 'Failed to load parking spots' });
  }
});

module.exports = router;

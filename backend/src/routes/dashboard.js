const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const allTime = req.query.allTime === '1' || req.query.allTime === 'true';
  const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
  const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';

  if (!allTime && (from || to) && (!from || !to)) {
    res.status(400).json({ error: 'Provide both from and to, or use allTime=1' });
    return;
  }

  try {
    const [spotStats] = await pool.query(`
      SELECT
        COUNT(*) AS totalSpots,
        SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) AS occupiedSpots,
        SUM(CASE WHEN status = 'free' THEN 1 ELSE 0 END) AS freeSpots
      FROM parking_spots
    `);

    let revenueSql = `
      SELECT
        COALESCE(SUM(total_cost), 0) AS totalRevenue,
        COUNT(*) AS completedSessions,
        COALESCE(AVG(TIMESTAMPDIFF(MICROSECOND, start_time, end_time)) / 3600000000, 0) AS avgDurationHours,
        MIN(TIMESTAMPDIFF(MICROSECOND, start_time, end_time)) / 3600000000 AS minDurationHours,
        MAX(TIMESTAMPDIFF(MICROSECOND, start_time, end_time)) / 3600000000 AS maxDurationHours
      FROM parking_sessions
      WHERE status = 'completed' AND end_time IS NOT NULL
    `;
    const params = [];
    if (!allTime && from && to) {
      revenueSql += ' AND end_time >= ? AND end_time <= ?';
      params.push(from, to);
    }

    const [revRows] = await pool.query(revenueSql, params);
    const rev = revRows[0] || {};
    const completedCount = Number(rev.completedSessions || 0);
    const hasSessions = completedCount > 0;

    res.json({
      spots: {
        total: Number(spotStats[0]?.totalSpots || 0),
        occupied: Number(spotStats[0]?.occupiedSpots || 0),
        free: Number(spotStats[0]?.freeSpots || 0),
      },
      analytics: {
        allTime: Boolean(allTime),
        from: allTime ? null : from || null,
        to: allTime ? null : to || null,
        totalRevenue: Number(rev.totalRevenue || 0),
        completedSessions: completedCount,
        averageParkingHours: hasSessions ? Number(rev.avgDurationHours) : null,
        minParkingHours: hasSessions ? Number(rev.minDurationHours) : null,
        maxParkingHours: hasSessions ? Number(rev.maxDurationHours) : null,
      },
    });
  } catch (err) {
    console.error('Dashboard:', err.message);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

router.post('/login', async (req, res) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const login = typeof req.body?.login === 'string' ? req.body.login.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!login || !password) {
    res.status(400).json({ error: 'Login and password are required' });
    return;
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, login, password_hash, role FROM users WHERE login = ? LIMIT 1',
      [login]
    );

    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid login or password' });
      return;
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ error: 'Invalid login or password' });
      return;
    }

    const token = jwt.sign(
      {
        login: user.login,
        role: user.role,
      },
      secret,
      {
        subject: String(user.id),
        expiresIn: JWT_EXPIRES_IN,
      }
    );

    res.json({
      token,
      user: {
        id: user.id,
        login: user.login,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      login: req.user.login,
      role: req.user.role,
    },
  });
});

module.exports = router;

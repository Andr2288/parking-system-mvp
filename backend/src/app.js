const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const parkingSpotsRoutes = require('./routes/parkingSpots');
const vehiclesRoutes = require('./routes/vehicles');
const parkingSessionsRoutes = require('./routes/parkingSessions');
const tariffsRoutes = require('./routes/tariffs');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Backend is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/parking-spots', parkingSpotsRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/parking-sessions', parkingSessionsRoutes);
app.use('/api/tariffs', tariffsRoutes);
app.use('/api/dashboard', dashboardRoutes);

module.exports = app;

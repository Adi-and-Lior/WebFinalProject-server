const express = require('express');
const cors = require('cors');
const path = require('path');

/* ---------- Load environment variables in non-production ---------- */
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 3000;

const { bucket, mongooseConnection } = require('./config/db');

/* ---------- Middleware ---------- */
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------- Load geo data on server start ---------- */
const { loadAllGeoData } = require('./utils/geoDataHelper');
loadAllGeoData();

/* ---------- Import and use routes ---------- */
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const geoRoutes = require('./routes/geo');
const enumsRoutes = require('./routes/enums');

app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', reportRoutes);
app.use('/api', geoRoutes);
app.use('/api', enumsRoutes);

/* ---------- Start server after DB connection ---------- */
mongooseConnection.once('open', () => {
  console.log('MongoDB connection and GridFSBucket ready. Starting server...');
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
});

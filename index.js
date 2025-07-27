const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables from .env file in non-production environments.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 3000;

const { bucket, mongooseConnection } = require('./config/db');

/* ---------- Middleware ---------- */
// Configures Cross-Origin Resource Sharing (CORS) for the application.
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parses incoming requests with JSON payloads.
app.use(express.json());

// Parses incoming requests with URL-encoded payloads.
app.use(express.urlencoded({ extended: true }));

// Loads geographical data (cities and streets) into memory when the server starts.
const { loadAllGeoData } = require('./utils/geoDataHelper');
loadAllGeoData();

// Imports and uses authentication routes.
const authRoutes = require('./routes/auth');

// Imports and uses user-related routes.
const userRoutes = require('./routes/users');

// Imports and uses report-related routes.
const reportRoutes = require('./routes/reports');

// Imports and uses geographical data routes.
const geoRoutes = require('./routes/geo');

app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', reportRoutes);
app.use('/api', geoRoutes);

// Serves static files (HTML, CSS, JS, images) from the 'client' directory.
app.use(express.static(path.join(__dirname, '..', 'client')));

// Serves the main 'index.html' file when accessing the root URL.
app.get('/', (_, res) =>
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'))
);

// Serves HTML pages from the 'client/html' directory based on the page name in the URL.
app.get('/html/:pageName', (req, res) => {
  const filePath = path.join(__dirname, '..', 'client', 'html', req.params.pageName);
  res.sendFile(filePath, err => {
    if (err) res.status(404).send('Page not found');
  });
});

/* ---------- Start server ---------- */
// Starts the Express server after MongoDB connection and GridFSBucket are initialized.
mongooseConnection.once('open', () => { 
  console.log('MongoDB connection and GridFSBucket are ready. Starting server...');
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
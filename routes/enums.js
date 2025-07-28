const express = require('express');
const router = express.Router();

const FaultType = require('../models/FaultType');
const LocationOption = require('../models/LocationOption');
const UploadOption = require('../models/UploadOption');
const FaultStatus = require('../models/FaultStatus');

// ------------------------------------
// נקודת קצה: GET /api/fault-types
router.get('/fault-types', async (req, res) => {
  try {
    const faultTypes = await FaultType.find({});
    res.json(faultTypes);
  } catch (error) {
    console.error('Error fetching fault types from DB:', error.message);
    res.status(500).json({ message: 'Failed to retrieve fault types from database.' });
  }
});

// ------------------------------------
// נקודת קצה: GET /api/location-options
router.get('/location-modes', async (req, res) => {
  try {
    const options = await LocationOption.find();
    res.json(options);
  } catch (err) {
    console.error('Error fetching location options from DB:', err.message);
    res.status(500).json({ error: 'Failed to load location options' });
  }
});

// ------------------------------------
// נקודת קצה: GET /api/media-options
router.get('/media-options', async (req, res) => {
  try {
    const options = await UploadOption.find();
    res.json(options);
  } catch (err) {
    console.error('Error fetching upload options from DB:', err.message);
    res.status(500).json({ error: 'Failed to load upload options' });
  }
});
// s// נקודת קצה: GET /api/status-options
router.get('/status-options', async (req, res) => {
  try {
    const statuses = await FaultStatus.find(); // אם זה אוסף ב-MongoDB
    res.json(statuses); // כל סטטוס עם id ושם למשל
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statuses' });
  }
});


module.exports = router;

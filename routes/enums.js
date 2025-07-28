const express = require('express');
const router = express.Router();

const FaultType = require('../models/FaultType');
const LocationOption = require('../models/LocationOption');
const UploadOption = require('../models/UploadOption');

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
router.get('/location-options', async (req, res) => {
  try {
    const options = await LocationOption.find();
    res.json(options);
  } catch (err) {
    console.error('Error fetching location options from DB:', err.message);
    res.status(500).json({ error: 'Failed to load location options' });
  }
});

// ------------------------------------
// נקודת קצה: GET /api/upload-options
router.get('/upload-options', async (req, res) => {
  try {
    const options = await UploadOption.find();
    res.json(options);
  } catch (err) {
    console.error('Error fetching upload options from DB:', err.message);
    res.status(500).json({ error: 'Failed to load upload options' });
  }
});

module.exports = router;

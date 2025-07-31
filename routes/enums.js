const express = require('express');
const router = express.Router();

const FaultType = require('../models/FaultType');
const LocationOption = require('../models/LocationOption');
const UploadOption = require('../models/UploadOption');
const FaultStatus = require('../models/FaultStatus');

/* ---------- GET /api/fault-types - Fetch all fault types from DB ---------- */
router.get('/fault-types', async (req, res) => {
  try {
    const faultTypes = await FaultType.find({});
    console.log(`[INFO] Retrieved ${faultTypes.length} fault types from database.`);
    res.json(faultTypes);
  } catch (error) {
    console.error('[ERROR] Failed to fetch fault types from DB:', error.message);
    res.status(500).json({ message: 'Failed to retrieve fault types from database.' });
  }
});

/* ---------- GET /api/location-modes - Fetch all location options from DB ---------- */
router.get('/location-modes', async (req, res) => {
  try {
    const options = await LocationOption.find();
    console.log(`[INFO] Retrieved ${options.length} location options from database.`);
    res.json(options);
  } catch (err) {
    console.error('[ERROR] Failed to fetch location options from DB:', err.message);
    res.status(500).json({ error: 'Failed to load location options' });
  }
});

/* ---------- GET /api/media-options - Fetch all upload options (media types) from DB ---------- */
router.get('/media-options', async (req, res) => {
  try {
    const options = await UploadOption.find();
    console.log(`[INFO] Retrieved ${options.length} media upload options from database.`);
    res.json(options);
  } catch (err) {
    console.error('[ERROR] Failed to fetch upload options from DB:', err.message);
    res.status(500).json({ error: 'Failed to load upload options' });
  }
});

/* ---------- GET /api/status-options - Fetch all fault statuses from DB ---------- */
router.get('/status-options', async (req, res) => {
  try {
    const statuses = await FaultStatus.find();
    console.log(`[INFO] Retrieved ${statuses.length} fault status options from database.`);
    res.json(statuses);
  } catch (error) {
    console.error('[ERROR] Failed to fetch status options from DB:', error.message);
    res.status(500).json({ error: 'Failed to fetch statuses' });
  }
});

module.exports = router;

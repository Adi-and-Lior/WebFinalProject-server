const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // נשאר פה רק ל-nominatim
const { getCities, getStreets } = require('../utils/geoDataHelper'); // ייבוא הפונקציות שמחזיקות את הנתונים

router.get('/cities', async (req, res) => {
    try {
        if (allCities.length === 0) {
            console.warn('Server: Cities data not yet loaded or empty. Attempting to reload...');
            await loadAllGeoData(); 
            if (allCities.length === 0) {
                return res.status(503).json({ message: 'Cities data not available yet.' });
            }
        }
        res.json(allCities);
    } catch (err) {
        console.error('Server: Error serving cities from memory:', err.message);
        res.status(500).json({ message: 'שגיאה בשרת בעת שליפת ערים.' });
    }
});

router.get('/streets', async (req, res) => {
    const cityQuery = req.query.city ? req.query.city.trim() : '';
    console.log(`Server: Received request for streets in city: '${cityQuery}'`);

    if (!cityQuery) {
        return res.status(400).json({ message: 'נא לספק שם עיר בפרמטר ?city=' });
    }
    if (allStreets.length === 0) {
        console.warn('Server: Streets data not yet loaded or empty. Attempting to reload...');
        await loadAllGeoData();
        if (allStreets.length === 0) {
            return res.status(503).json({ message: 'Streets data not available yet.' });
        }
    }
    try {
        const lowerCaseCityQuery = cityQuery.toLowerCase();
        const filteredStreets = allStreets
            .filter(item => item.city && item.city.toLowerCase().includes(lowerCaseCityQuery))
            .map(item => item.street)
            .filter((val, i, arr) => val && arr.indexOf(val) === i) 
            .sort();
        console.log(`Server: Found ${filteredStreets.length} streets for city query '${cityQuery}'.`);
        res.json(filteredStreets);
    } catch (err) {
        console.error('Server: Error serving streets from memory:', err.message);
        res.status(500).json({ message: 'שגיאה בשרת בעת שליפת רחובות.' });
    }
});

router.get('/google-maps-api-key', (req, res) => {
  // שלח את מפתח ה-API מהמשתנים הסביבתיים
  const apiKey = process.env.Maps_API_KEY;
  if (!apiKey) {
    console.error('Google Maps API Key אינו מוגדר במשתני הסביבה!');
    return res.status(500).json({ message: 'מפתח API למפות אינו זמין בשרת.' });
  }
  res.json({ apiKey: apiKey });
});

router.get('/reverse-geocode', async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
      headers: {
        'User-Agent': 'SafeReportingApp/1.0'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'בעיה מהשרת של Nominatim' });
    }
    const data = await response.json();
    res.json(data.address);
  } catch (error) {
    console.error('שגיאה בשרת:', error);
    res.status(500).json({ error: 'שגיאה בפענוח מיקום' });
  }
});

module.exports = router;
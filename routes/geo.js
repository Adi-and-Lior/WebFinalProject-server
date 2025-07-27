const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); 
const { getCities, getStreets } = require('../utils/geoDataHelper'); 

router.get('/cities', async (req, res) => {
    try {
        const cities = getCities();
        if (!cities || cities.length === 0) {
            console.error('Server: Cities data is empty. Initial load might have failed.');
            return res.status(500).json({ message: 'נתוני ערים אינם זמינים בשרת. ייתכן שיש בעיה בטעינה ראשונית.' });
        }
        res.json(cities);
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
    try {
        const allStreetsData = getStreets(); 
        if (!allStreetsData || allStreetsData.length === 0) {
            console.error('Server: Streets data is empty. Initial load might have failed.');
            return res.status(500).json({ message: 'נתוני רחובות אינם זמינים בשרת. ייתכן שיש בעיה בטעינה ראשונית.' });
        }
        const lowerCaseCityQuery = cityQuery.toLowerCase();
        const filteredStreets = allStreetsData
            .filter(item => item.city && item.city.toLowerCase() === lowerCaseCityQuery) 
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
        const errorText = await response.text();
        console.error(`Error from Nominatim: ${response.status} - ${errorText}`);
        return res.status(response.status).json({ error: `בעיה מהשרת של Nominatim: ${response.status}` });
      }
      const data = await response.json();
      res.json(data.address);
    } catch (error) {
      console.error('שגיאה בשרת Nominatim:', error); // שינוי ללוג מפורט יותר
      res.status(500).json({ error: 'שגיאה בפענוח מיקום' });
    }
});

module.exports = router;
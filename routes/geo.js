const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); 
const { getCities, getStreets } = require('../utils/geoDataHelper'); 

/* ---------- Handles requests to get a list of cities ---------- */
/* 
  This endpoint returns a list of cities stored in memory (loaded from a helper module).
  If data is missing or empty, logs an error and responds with 500.
*/
router.get('/cities', async (req, res) => {
    try {
        const cities = getCities();
        if (!cities || cities.length === 0) {
            console.error('Server: Cities data is empty. Initial load might have failed.');
            return res.status(500).json({ message: 'City data not available on server. Initial load may have failed.' });
        }
        res.json(cities);
    } catch (err) {
        console.error('Server: Error serving cities from memory:', err.message);
        res.status(500).json({ message: 'Server error while retrieving cities.' });
    }
});

/* ---------- Handles requests to get a list of streets for a given city ---------- */
/* 
  This endpoint expects a query param "city" and returns a filtered, sorted list of unique streets for that city.
  Validation and error handling included.
*/
router.get('/streets', async (req, res) => {
    const cityQuery = req.query.city ? req.query.city.trim() : '';
    console.log(`Server: Received request for streets in city: '${cityQuery}'`);

    if (!cityQuery) {
        return res.status(400).json({ message: 'Please provide a city name as ?city=' });
    }

    try {
        const allStreetsData = getStreets(); 
        if (!allStreetsData || allStreetsData.length === 0) {
            console.error('Server: Streets data is empty. Initial load might have failed.');
            return res.status(500).json({ message: 'Street data not available on server. Initial load may have failed.' });
        }

        const lowerCaseCityQuery = cityQuery.toLowerCase();

        // Filter streets matching the city, get unique street names, sort alphabetically
        const filteredStreets = allStreetsData
            .filter(item => item.city && item.city.toLowerCase().includes(lowerCaseCityQuery)) 
            .map(item => item.street)
            .filter((val, i, arr) => val && arr.indexOf(val) === i) 
            .sort();

        console.log(`Server: Found ${filteredStreets.length} streets for city query '${cityQuery}'.`);
        res.json(filteredStreets);
    } catch (err) {
        console.error('Server: Error serving streets from memory:', err.message);
        res.status(500).json({ message: 'Server error while retrieving streets.' });
    }
});

/* ---------- Handles requests to get the Google Maps API key ---------- */
/* 
  Returns the API key stored in environment variables.
  Logs error if key is missing.
*/
router.get('/google-maps-api-key', (req, res) => {
    const apiKey = process.env.Maps_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API Key not configured in environment variables!');
      return res.status(500).json({ message: 'Maps API key not available on server.' });
    }
    res.json({ apiKey: apiKey });
});

/* ---------- Handles reverse geocoding requests using Nominatim ---------- */
/* 
  Accepts lat/lon as query parameters, validates them, then calls OpenStreetMap Nominatim API 
  to get address data. Includes error handling and user-agent header for compliance.
*/
router.get('/reverse-geocode', async (req, res) => {
    const { lat, lon } = req.query;
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
        console.error(`[SERVER ERROR] Invalid lat/lon received for reverse-geocode: lat=${lat}, lon=${lon}`);
        return res.status(400).json({ error: 'Latitude and Longitude must be valid numbers.' });
    }

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
        headers: {
          'User-Agent': 'SafeReportingApp/1.0' // Required by Nominatim usage policy
        }
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error from Nominatim: ${response.status} - ${errorText}`);
        return res.status(response.status).json({ error: `Error from Nominatim server: ${response.status}` });
      }

      const data = await response.json();
      res.json(data.address);
    } catch (error) {
      console.error('Nominatim server error:', error); 
      res.status(500).json({ error: 'Error decoding location.' });
    }
});

/* ---------- Google Geocoding API Proxy ---------- */
/* 
  Proxies requests to Google Geocoding API to avoid exposing API key to client.
  Supports either latlng or address parameters.
  Includes error handling for missing API key and failed fetches.
*/
router.get('/geocode', async (req, res) => {
    const apiKey = process.env.Maps_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API Key not configured in environment variables!');
      return res.status(500).json({ error: 'Maps API key not available on server.' });
    }

    const { latlng, address } = req.query;

    if (!latlng && !address) {
      return res.status(400).json({ error: 'Must provide either latlng or address parameter.' });
    }

    let googleUrl = 'https://maps.googleapis.com/maps/api/geocode/json?';

    if (latlng) {
      googleUrl += `latlng=${encodeURIComponent(latlng)}`;
    } else if (address) {
      googleUrl += `address=${encodeURIComponent(address)}`;
    }

    googleUrl += `&key=${apiKey}`;

    try {
      const response = await fetch(googleUrl);
      if (!response.ok) {
        const errText = await response.text();
        console.error(`Google Geocoding API returned error: ${response.status} - ${errText}`);
        return res.status(response.status).json({ error: 'Error calling Google Geocoding API' });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching Google Geocoding API:', error);
      res.status(500).json({ error: 'Server error while contacting Google Geocoding API' });
    }
});

module.exports = router;

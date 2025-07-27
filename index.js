const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt'); /////////////////////////////
const mongoose = require('mongoose'); // נשאיר פה לחיבור הכללי

// טעינת משתני סביבה
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const app = express();
const PORT = process.env.PORT || 3000;

// --- תצורה וחיבורים ---
require('./config/db'); // חיבור למונגוDB
const { bucket } = require('./config/db'); // ייצוא ה-bucket לשימוש ב-routes


/* ---------- Middleware ---------- */
app.use(cors({
  origin      : process.env.CORS_ORIGIN || '*',
  methods     : ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- טעינת נתונים גאוגרפיים בהפעלה ---
const { loadAllGeoData } = require('./utils/geoDataHelper');
loadAllGeoData();

// --- ייבוא ושימוש בניתובים (Routes) ---
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const geoRoutes = require('./routes/geo');

app.use('/api', authRoutes); // /api/login, /api/register
app.use('/api', userRoutes); // /api/users
app.use('/api', reportRoutes); // /api/reports, /api/reports/:id, /api/employee-reports, /api/all-reports-locations
app.use('/api', geoRoutes); // /api/cities, /api/streets, /api/reverse-geocode, /api/google-maps-api-key

// --- הגשת קבצים סטטיים מהלקוח ---
app.use(express.static(path.join(__dirname, '..', 'client')));

app.get('/', (_, res) =>
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'))
);

// ניתוב עבור דפי HTML בתוך תיקיית 'html'
app.get('/html/:pageName', (req, res) => {
  const filePath = path.join(__dirname, '..', 'client', 'html', req.params.pageName);
  res.sendFile(filePath, err => {
    if (err) res.status(404).send('Page not found');
  });
});

/* ---------- Static client & uploads ---------- */
app.use(express.static(path.join(__dirname, '..', 'client')));

app.get('/', (_, res) =>
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'))
);
app.get('/html/:pageName', (req, res) => {
  const filePath = path.join(__dirname, '..', 'client', 'html', req.params.pageName);
  res.sendFile(filePath, err => {
    if (err) res.status(404).send('Page not found');
  });
});

/* ---------- Start server ---------- */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

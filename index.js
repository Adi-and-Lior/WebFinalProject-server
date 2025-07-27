const express = require('express');
const cors = require('cors');
const path = require('path');

// טעינת משתני סביבה
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 3000;

// --- תצורה וחיבורים ל-MongoDB ו-GridFS ---
// ייבוא פונקציית החיבור והאובייקטים המיוצאים
// ודא שאתה מייבא רק פעם אחת ומה שצריך
const { bucket, mongooseConnection } = require('./config/db'); // <--- שורה זו בסדר גמור כעת

/* ---------- Middleware ---------- */
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
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

app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', reportRoutes);
app.use('/api', geoRoutes);

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

/* ---------- Start server ---------- */
// הקשבה לפורט רק לאחר שחיבור MongoDB ו-GridFSBucket מוכנים
mongooseConnection.once('open', () => { // <--- שורה זו בסדר, הבעיה היא בייבוא
  console.log('MongoDB connection and GridFSBucket are ready. Starting server...');
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const multer = require('multer');
const mongoose = require('mongoose');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- MongoDB ---------- */
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log('Connected to MongoDB database.'))
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });

let bucket;
mongoose.connection.once('open', () => {
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
    });
    console.log('GridFSBucket initialized.');
});

/* ---------- Schemas ---------- */
const userSchema = new mongoose.Schema({
  username : { type: String, required: true, unique: true },
  password : { type: String, required: true },
  userType : { type: String, required: true },
  city     : {
    type    : String,
    required() {
      return (this.userType || '').toLowerCase() === 'employee';
    }
  },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const reportSchema = new mongoose.Schema({
  faultType           : { type: String, required: true },
  faultDescription    : { type: String },
  location            : {
    type        : { type: String, required: true },
    city        : { type: String, required: true },
    street      : { type: String },
    houseNumber : { type: String },
    latitude    : { type: Number },
    longitude   : { type: Number }
  },
  media               : { type: mongoose.Schema.Types.ObjectId, default: null },
  mediaMimeType       : { type: String, default: null },
  timestamp           : { type: Date, default: Date.now },
  createdBy           : { type: String },
  creatorId           : { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  status              : { type: String, default: 'in-progress' },
  municipalityResponse: { type: String, default: null }
});
const Report = mongoose.model('Report', reportSchema);

/* ---------- Middleware ---------- */
app.use(cors({
  origin      : process.env.CORS_ORIGIN || '*',
  methods     : ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------- File uploads (with GridFS) ---------- */
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ---------- Auth routes ---------- */
app.post('/api/login', async (req, res) => {
  const { username, password, userType } = req.body;
  try {
    const foundUser = await User.findOne({ username, userType });
    if (!foundUser) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
    }
    const ok = await bcrypt.compare(password, foundUser.password);
    if (!ok) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
    }
    res.json({
      message: 'Login successful',
      user   : {
        username: foundUser.username,
        userType: foundUser.userType,
        userId  : foundUser._id.toString(),
        city    : foundUser.city
      }
    });
  } catch (err) {
    console.error('Error during login:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית.' });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, password, userType, city } = req.body;
  try {
    if (await User.findOne({ username, userType })) {
      return res.status(409).json({ error: 'משתמש עם שם משתמש וסוג זה כבר קיים.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const newUser = await new User({ username, password: hashed, userType, city }).save();
    res.status(201).json({
      user: {
        username: newUser.username,
        userType: newUser.userType,
        userId: newUser._id.toString(),
        city: newUser.city
      }
    });
  } catch (err) {
    console.error('Error registering new user:', err.message);
    res.status(500).json({ error: 'שגיאה בעת הרשמת משתמש חדש.' });
  }
});

/* ---------- Users list ---------- */
app.get('/api/users', async (_, res) => {
  try {
    const users = await User.find({}, 'username userType _id city');
    res.json(users.map(u => ({
      id: u._id.toString(),
      username: u.username,
      userType: u.userType,
      city: u.city
    })));
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ message: 'Failed to load users.' });
  }
});


// Global variables to store cities and streets data in memory
let allCities = [];
let allStreets = [];

// Function to load all cities and streets from data.gov.il on server startup
async function loadAllGeoData() {
    console.log('Server: Starting to load all geo data from data.gov.il...');
    try {
        // Load cities
        const citiesUrl = 'https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=100000'; // Increased limit
        const citiesResponse = await fetch(citiesUrl);
        const citiesData = await citiesResponse.json();

        if (!citiesData.success) {
            console.error('Server: Failed to fetch cities from external API.');
            return;
        }
        allCities = citiesData.result.records.map(r => r.שם_ישוב).filter((v, i, a) => a.indexOf(v) === i).sort();
        console.log(`Server: Loaded ${allCities.length} unique cities.`);

        // Load streets (might need to iterate if total is > 32000)
        // For simplicity, let's assume one fetch is enough for now, or fetch in chunks if needed
        const streetsResourceId = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b';
        const streetsUrl = `https://data.gov.il/api/3/action/datastore_search?resource_id=${streetsResourceId}&limit=100000`; // Increased limit
        const streetsResponse = await fetch(streetsUrl);
        const streetsData = await streetsResponse.json();

        if (!streetsData.success) {
            console.error('Server: Failed to fetch streets from external API.');
            return;
        }
        // Store objects with city and street name for easier lookup
        allStreets = streetsData.result.records.map(r => ({
            city: r.שם_ישוב,
            street: r.שם_רחוב
        })).filter(item => item.city && item.street); // Filter out entries with missing city/street
        console.log(`Server: Loaded ${allStreets.length} street records.`);

    } catch (err) {
        console.error('Server: Error loading geo data on startup:', err.message);
    }
}

// Call this function when the server starts
loadAllGeoData();


// נתיב שמחזיר את רשימת הערים בישראל (כעת מזיכרון)
app.get('/api/cities', async (req, res) => {
    try {
        if (allCities.length === 0) {
            console.warn('Server: Cities data not yet loaded or empty. Attempting to reload...');
            await loadAllGeoData(); // Try reloading if empty
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

// נתיב שמחזיר את רשימת הרחובות לעיר מסוימת (כעת מזיכרון עם סינון גמיש)
app.get('/api/streets', async (req, res) => {
    const cityQuery = req.query.city ? req.query.city.trim() : '';
    console.log(`Server: Received request for streets in city: '${cityQuery}'`);

    if (!cityQuery) {
        return res.status(400).json({ message: 'נא לספק שם עיר בפרמטר ?city=' });
    }

    if (allStreets.length === 0) {
        console.warn('Server: Streets data not yet loaded or empty. Attempting to reload...');
        await loadAllGeoData(); // Try reloading if empty
        if (allStreets.length === 0) {
            return res.status(503).json({ message: 'Streets data not available yet.' });
        }
    }

    try {
        const lowerCaseCityQuery = cityQuery.toLowerCase();

        // Filter streets based on partial, case-insensitive match of the city name
        // And then extract unique street names
        const filteredStreets = allStreets
            .filter(item => item.city && item.city.toLowerCase().includes(lowerCaseCityQuery))
            .map(item => item.street)
            .filter((val, i, arr) => val && arr.indexOf(val) === i) // Ensure unique and not null/undefined
            .sort();

        console.log(`Server: Found ${filteredStreets.length} streets for city query '${cityQuery}'.`);
        res.json(filteredStreets);
    } catch (err) {
        console.error('Server: Error serving streets from memory:', err.message);
        res.status(500).json({ message: 'שגיאה בשרת בעת שליפת רחובות.' });
    }
});


/* ---------- Reports ---------- */
app.post('/api/reports', upload.single('mediaFile'), async (req, res) => {
  console.log('[Server] req.file:', req.file);
  console.log('[Server] req.body:', req.body);

  let location;
  try {
    location = JSON.parse(req.body.locationDetails);
    console.log('[Server] Parsed location:', location);
    if (!location.city) {
      return res.status(400).json({ message: 'Location details must include a city.' });
    }
  } catch {
    return res.status(400).json({ message: 'Invalid location details format.' });
  }

  let mediaId = null;
  let mediaMimeType = null;

  try {
    if (req.file) {
      // Use promise to await upload finish event
      mediaId = await new Promise((resolve, reject) => {
        const uploadStream = bucket.openUploadStream(req.file.originalname, {
          contentType: req.file.mimetype,
        });

        uploadStream.end(req.file.buffer);

        uploadStream.on('finish', () => {
          console.log('[Server] File uploaded to GridFS with id:', uploadStream.id);
          resolve(uploadStream.id);
        });

        uploadStream.on('error', (err) => {
          console.error('[Server] Error uploading file to GridFS:', err);
          reject(err);
        });
      });

      mediaMimeType = req.file.mimetype;
    }

    const newReport = await new Report({
      faultType: req.body.faultType,
      faultDescription: req.body.faultDescription,
      location,
      media: mediaId,
      mediaMimeType,
      createdBy: req.body.createdBy,
      creatorId: req.body.creatorId,
      status: 'in-progress'
    }).save();

    // החזר מזהי המדיה כמחרוזות כדי שלא יהיו בעיות בקליינט
    res.status(201).json({
      message: 'Report submitted successfully!',
      reportId: newReport._id.toString(),
      mediaGridFSId: mediaId ? mediaId.toString() : null,
      mediaMimeType
    });

  } catch (err) {
    console.error('Error saving report:', err.message);
    res.status(500).json({ message: 'Failed to save report.' });
  }
});

app.get('/api/reports/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    res.json(report);
  } catch (err) {
    console.error('Error fetching report:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid Report ID format.' });
    }
    res.status(500).json({ message: 'Failed to load report details.' });
  }
});

// הוסף את זה לקובץ השרת הראשי שלך (server.js), בתוך קטע ה-Reports או בנפרד

app.get('/api/my-reports-locations', async (req, res) => {
    const creatorId = req.query.creatorId; 

    try {
        const query = creatorId ? { creatorId: creatorId } : {}; 
        
        const reports = await Report.find(query); 

        const locations = reports.map(report => {
            if (report.location && typeof report.location.latitude === 'number' && typeof report.location.longitude === 'number') {
                return {
                    lat: report.location.latitude,
                    lng: report.location.longitude,
                    title: report.faultType || 'דיווח' 
                };
            }
            return null;
        }).filter(Boolean); 

        res.json(locations);
    } catch (error) {
        console.error('שגיאה בשליפת מיקומי דיווחים למפה:', error.message);
        res.status(500).json({ message: 'שגיאה בשרת בעת שליפת מיקומי דיווחים.' });
    }
});

app.get('/api/google-maps-api-key', (req, res) => {
  // שלח את מפתח ה-API מהמשתנים הסביבתיים
  const apiKey = process.env.Maps_API_KEY;

  if (!apiKey) {
    console.error('Google Maps API Key אינו מוגדר במשתני הסביבה!');
    return res.status(500).json({ message: 'מפתח API למפות אינו זמין בשרת.' });
  }

  res.json({ apiKey: apiKey });
});


/* ---------- Update report ---------- */
app.put('/api/reports/:id', async (req, res) => {
  const { status, municipalityResponse } = req.body;
  if (status === undefined && municipalityResponse === undefined) {
    return res.status(400).json({ message: 'Nothing to update.' });
  }

  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });

    if (status !== undefined)          report.status             = status;
    if (municipalityResponse !== undefined) report.municipalityResponse = municipalityResponse;

    await report.save();
    res.json({ message: 'Report updated successfully.', report });
  } catch (err) {
    console.error('Error updating report:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid Report ID format.' });
    }
    res.status(500).json({ message: 'Failed to update report.' });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const query = req.query.creatorId ? { creatorId: req.query.creatorId } : {};
    const reports = await Report.find(query).sort({ timestamp: -1 });
    res.json(reports);
  } catch (err) {
    console.error('Error fetching reports:', err.message);
    res.status(500).json({ message: 'Failed to load reports.' });
  }
});

app.get('/api/employee-reports', async (req, res) => {
  try {
    const { city, status } = req.query;
    if (!city) return res.status(400).json({ message: 'Missing employee city.' });

    const query = { 'location.city': city };
    if (status && status !== 'all') query.status = status;

    const reports = await Report.find(query).sort({ timestamp: -1 });
    res.json(reports);
  } catch (err) {
    console.error('Error fetching employee reports:', err.message);
    res.status(500).json({ message: 'Failed to load employee-relevant reports.' });
  }
});

/* ---------- Delete report (incl. media in GridFS) ---------- */
app.delete('/api/reports/:id', async (req, res) => {
  const reportId = req.params.id;
  const userId = req.query.userId;

  try {
    const report = await Report.findById(reportId);

    if (!report) {
      return res.status(404).json({ message: 'הדיווח לא נמצא.' });
    }

    if (report.creatorId.toString() !== userId) {
      return res.status(403).json({ message: 'אין לך הרשאה למחוק דיווח זה.' });
    }

    if (report.media) {
      try {
        const mediaFileId = new mongoose.Types.ObjectId(report.media);
        // מחיקת המטא־דאטה של הקובץ
        await mongoose.connection.db.collection('uploads.files').deleteOne({ _id: mediaFileId });
        // מחיקת הצ'אנקים של הקובץ
        await mongoose.connection.db.collection('uploads.chunks').deleteMany({ files_id: mediaFileId });
        console.log(`Media file deleted from GridFS: ${report.media}`);
      } catch (err) {
        console.error(`שגיאה במחיקת קובץ מדיה מ-GridFS (${report.media}):`, err);
      }
    }

    await Report.findByIdAndDelete(reportId);

    res.json({ message: 'הדיווח נמחק בהצלחה.' });
  } catch (err) {
    console.error('שגיאה במחיקת דיווח:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'מזהה דיווח לא תקין.' });
    }
    res.status(500).json({ message: 'שגיאה בשרת בעת מחיקת הדיווח.' });
  }
});

/* ---------- Delete user and their reports ---------- */
app.delete('/api/users/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    // מחיקת כל הדיווחים של המשתמש
    const deleteReportsResult = await Report.deleteMany({ creatorId: userId });
    console.log(`Deleted ${deleteReportsResult.deletedCount} reports for user ${userId}.`);

    // מחיקת המשתמש עצמו
    const deleteUserResult = await User.findByIdAndDelete(userId);

    if (!deleteUserResult) {
      return res.status(404).json({ message: 'המשתמש לא נמצא.' });
    }

    res.json({ message: 'החשבון וכל הדיווחים הקשורים נמחקו בהצלחה.' });
  } catch (err) {
    console.error('Error deleting user and their reports:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'מזהה משתמש לא תקין.' });
    }
    res.status(500).json({ message: 'שגיאה בשרת בעת מחיקת החשבון.' });
  }
});

/* ---------- Serve media files from GridFS ---------- */
app.get('/api/media/:fileId', async (req, res) => {
  try {
    if (!bucket) {
      console.error('GridFSBucket is not initialized yet.');
      return res.status(500).json({ message: 'Server error: GridFSBucket not ready.' });
    }
    console.log('[Server] Requested fileId:', req.params.fileId);
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);

    const files = await mongoose.connection.db.collection('uploads.files').find({ _id: fileId }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'No file exists.' });
    }

    const file = files[0];

    res.set('Content-Type', file.contentType);
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);

    const downloadStream = bucket.openDownloadStream(fileId);
    console.log('[Server] Found files:', files);
    downloadStream.on('error', (err) => {
      console.error('Error streaming file:', err);
      console.error(err.stack);
      res.sendStatus(500);
    });

    downloadStream.pipe(res);

  } catch (err) {
    console.error('Error fetching file from GridFS:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid file ID format.' });
    }
    res.status(500).json({ message: 'Failed to retrieve media file.' });
  }
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

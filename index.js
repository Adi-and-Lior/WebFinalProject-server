const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const bcrypt     = require('bcrypt');
const multer     = require('multer');
const mongoose   = require('mongoose');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app  = express();
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
  origin        : process.env.CORS_ORIGIN || '*',
  methods       : ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
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

// נתיב שמחזיר את רשימת הערים בישראל
app.get('/api/cities', async (req, res) => {
  try {
    const url = 'https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=10000';
    const response = await fetch(url);
    const data = await response.json();

    if (!data.success) {
      return res.status(500).json({ message: 'שליפת הערים נכשלה.' });
    }

    const cities = data.result.records.map(r => r.שם_ישוב).filter((v, i, a) => a.indexOf(v) === i);
    res.json(cities.sort());
  } catch (err) {
    console.error('שגיאה בשליפת ערים:', err.message);
    res.status(500).json({ message: 'שגיאה בשרת בעת שליפת ערים.' });
  }
});

// נתיב שמחזיר את רשימת הרחובות לעיר מסוימת
app.get('/api/streets', async (req, res) => {
  const city = req.query.city;
  if (!city) return res.status(400).json({ message: 'נא לציין שם עיר בפרמטר ?city=' });

  try {
    const encodedCity = encodeURIComponent(city);
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=dcb3e209-471c-4b4d-a9dd-070bcb4b6078&limit=10000&q=${encodedCity}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.success) {
      return res.status(500).json({ message: 'שליפת הרחובות נכשלה.' });
    }

    const streets = data.result.records
      .filter(r => r.שם_ישוב === city)
      .map(r => r.שם_רחוב)
      .filter((v, i, a) => a.indexOf(v) === i);

    res.json(streets.sort());
  } catch (err) {
    console.error('שגיאה בשליפת רחובות:', err.message);
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

/* ---------- Update report ---------- */
app.put('/api/reports/:id', async (req, res) => {
  const { status, municipalityResponse } = req.body;
  if (status === undefined && municipalityResponse === undefined) {
    return res.status(400).json({ message: 'Nothing to update.' });
  }

  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });

    if (status !== undefined)             report.status              = status;
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

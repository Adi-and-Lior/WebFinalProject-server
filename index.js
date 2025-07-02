const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const bcrypt     = require('bcrypt');
const fs         = require('fs');
const multer     = require('multer');
const mongoose   = require('mongoose');

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
  media               : { type: String },
  timestamp           : { type: Date, default: Date.now },
  createdBy           : { type: String },
  creatorId           : { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  status              : { type: String, default: 'in-progress' },
  municipalityResponse: { type: String, default: null }
});
const Report = mongoose.model('Report', reportSchema);

/* ---------- Middleware ---------- */
app.use(
  cors({
    origin        : process.env.CORS_ORIGIN || '*',
    methods       : ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------- File uploads ---------- */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log(`Created uploads directory at: ${uploadDir}`);
}
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename  : (_, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
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
        userId  : foundUser._id.toString(), // הוסף את ה-ID של המשתמש
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
        userId: newUser._id.toString(), // הוסף את ה-ID של המשתמש גם ברישום
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
    res.json(
      users.map(u => ({
        id: u._id.toString(),
        username: u.username,
        userType: u.userType,
        city: u.city
      }))
    );
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ message: 'Failed to load users.' });
  }
});

/* ---------- Reports ---------- */
app.post('/api/reports', upload.single('mediaFile'), async (req, res) => {
  let location;
  try {
    location = JSON.parse(req.body.locationDetails);
    if (!location.city) {
      return res.status(400).json({ message: 'Location details must include a city.' });
    }
  } catch {
    return res.status(400).json({ message: 'Invalid location details format.' });
  }

  try {
    const newReport = await new Report({
      faultType: req.body.faultType,
      faultDescription: req.body.faultDescription,
      location,
      media: req.file ? req.file.filename : null,
      createdBy: req.body.createdBy,
      creatorId: req.body.creatorId,
      status: 'in-progress'
    }).save();

    res.json({
      message: 'Report submitted successfully!',
      reportId: newReport._id,
      mediaFileNameOnServer: req.file ? req.file.filename : null
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

/* ---------- נתיב PUT חדש לעדכון דיווח ---------- */
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
      const mediaPath = path.join(uploadDir, report.media); 
      fs.unlink(mediaPath, (err) => {
        if (err) {
          console.error(`שגיאה במחיקת קובץ מדיה מהדיסק: ${mediaPath}`, err);
        } else {
          console.log(`קובץ מדיה נמחק מהדיסק: ${mediaPath}`);
        }
      });
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
// **סיום של בלוק הדיווחים**


app.delete('/api/users/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    // 1. מחיקת כל הדיווחים שהוגשו על ידי משתמש זה
    const deleteReportsResult = await Report.deleteMany({ creatorId: userId });
    console.log(`Deleted ${deleteReportsResult.deletedCount} reports for user ${userId}.`);

    // 2. מחיקת המשתמש עצמו
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

/* ---------- Static client & uploads ---------- */
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/uploads', express.static(uploadDir));

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
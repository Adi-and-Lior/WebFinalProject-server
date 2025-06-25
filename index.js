// ייבוא ספריות
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose'); // ייבוא ספריית Mongoose

// לטעינת משתני סביבה מקובץ .env בפיתוח מקומי
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 3000;

// *** חיבור ל-MongoDB באמצעות Mongoose ***
mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB database.'))
.catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1); // יציאה מהאפליקציה אם החיבור נכשל
});

// *** הגדרת סכימות ומודלים (Schemas & Models) עבור MongoDB ***

// סכימת משתמש (User Schema)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userType: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// סכימת דיווח (Report Schema)
const reportSchema = new mongoose.Schema({
    faultType: { type: String, required: true },
    faultDescription: { type: String },
    location: { // אובייקט JSON לנתוני מיקום
        type: { type: String, required: true }, // 'manual' or 'current'
        city: { type: String },
        street: { type: String },
        houseNumber: { type: String },
        latitude: { type: Number },
        longitude: { type: Number }
    },
    media: { type: String }, // שם הקובץ שהועלה (נשמר אפמרית)
    timestamp: { type: Date, default: Date.now },
    createdBy: { type: String },
    creatorId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' }, 
    status: { type: String, default: 'in-progress' }
});

const Report = mongoose.model('Report', reportSchema);


// *** הגדרת CORS ***
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- הגדרת Multer לאחסון קבצים (עדיין מקומי/אפמרי) ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log(`Created uploads directory at: ${uploadDir}`);
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });


// --- נקודות הקצה של ה-API שלך (כעת עם MongoDB/Mongoose) ---

// נקודת קצה ללוגין
app.post('/api/login', async (req, res) => { // *** שינוי: נוסף /api ***
    const { username, password, userType } = req.body;

    try {
        const foundUser = await User.findOne({ username: username, userType: userType });
        console.log('Found user object:', foundUser);
        if (!foundUser) {
            console.log('Login failed: User not found or type mismatch.');
            return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
        }

        const passwordMatch = await bcrypt.compare(password, foundUser.password);

        if (passwordMatch) {
            console.log('Login successful.');
            res.status(200).json({
                message: 'Login successful',
                user: {
                    username: foundUser.username,
                    userType: foundUser.userType,
                    userId: foundUser._id
                }
            });
        } else {
            console.log('Login failed: Password mismatch.');
            res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
        }
    } catch (err) {
        console.error('Error during login:', err.message);
        res.status(500).json({ error: 'שגיאת שרת פנימית.' });
    }
});

// נקודת קצה ליצירת משתמש חדש
app.post('/api/register', async (req, res) => { // *** שינוי: נוסף /api ***
    const { username, password, userType } = req.body;

    try {
        // בדוק אם משתמש כבר קיים
        const existingUser = await User.findOne({ username: username, userType: userType });
        if (existingUser) {
            return res.status(409).json({ error: 'משתמש עם שם משתמש וסוג זה כבר קיים.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        

        const newUser = new User({
            username,
            password: hashedPassword,
            userType,
        });

        await newUser.save(); // שמירה ל-MongoDB
        console.log(`New user registered: ${username} (${userType}) with ID: ${newUser._id}`);        res.status(201).json({ user: { username, userType, userId:newUser._id } });

    } catch (error) {
        console.error('Error registering new user:', error.message);
        res.status(500).json({ error: 'שגיאה בעת הרשמת משתמש חדש.' });
    }
});

// נקודת קצה לקבלת רשימת משתמשים (ללא סיסמאות)
app.get('/api/users', async (req, res) => { // *** שינוי: נוסף /api ***
    try {
        const users = await User.find({}, 'username userType _id'); 
        const publicUsers = users.map(user => ({
            id: user._id.toString(), // השתמש ב-numericId
            username: user.username,
            userType: user.userType
        }));
        res.json(publicUsers);
    } catch (err) {
        console.error('Error fetching users:', err.message);
        res.status(500).json({ message: 'Failed to load users.' });
    }
});


// --- נקודת קצה עבור שליחת דיווחים ---
app.post('/api/reports', upload.single('mediaFile'), async (req, res) => {
    let parsedLocationDetails = {};
    try {
        parsedLocationDetails = JSON.parse(req.body.locationDetails);
    } catch (e) {
        console.error("Error parsing locationDetails:", e);
        return res.status(400).json({ message: 'Invalid location details format.' });
    }

    const { faultType, faultDescription, locationType, uploadOption, createdBy, creatorId } = req.body;
    const uploadedFile = req.file;

    console.log('Received Report Data:');
    console.log('Fault Type:', faultType);
    console.log('Fault Description:', faultDescription);
    console.log('Location Type:', locationType);
    console.log('Parsed Location Details:', parsedLocationDetails);
    console.log('Upload Option:', uploadOption);
    if (uploadedFile) {
        console.log('Uploaded File:', uploadedFile.filename, uploadedFile.path);
    }
    console.log('Created By:', createdBy);
    console.log('Creator ID:', creatorId);

    try {
        const newReport = new Report({
            faultType: faultType,
            faultDescription: faultDescription,
            location: parsedLocationDetails, // נשמר כאובייקט JSON בתוך המסמך
            media: uploadedFile ? uploadedFile.filename : null,
            timestamp: Date.now(),
            createdBy: createdBy,
            creatorId: creatorId,
            status: 'pending'
        });

        await newReport.save(); // שמירה ל-MongoDB
        console.log(`Report saved successfully with MongoDB _id: ${newReport._id}`);
        res.status(200).json({
            message: 'Report submitted successfully!',
            reportId: newReport._id, // ה-ID ש-MongoDB יצר (_id)
            mediaFileNameOnServer: uploadedFile ? uploadedFile.filename : null
        });
    } catch (err) {
        console.error('Error saving report to MongoDB:', err.message);
        res.status(500).json({ message: 'Failed to save report.' });
    }
});

// --- נקודת קצה לקבלת דיווחים (לצורך הצגה) ---
app.get('/api/reports', async (req, res) => {
    try {
        let query = {}; // אובייקט שאילתה ריק כברירת מחדל
        // בדוק אם נשלח creatorId כפרמטר שאילתה
        if (req.query.creatorId) {
            query.creatorId = req.query.creatorId; // אם קיים, הוסף אותו לשאילתה
        }

        const reports = await Report.find(query).sort({ timestamp: -1 }); // מיון מהחדש לישן
        const formattedReports = reports.map(report => ({
            id: report._id, // ה-ID של הדיווח הוא ה-_id של MongoDB
            faultType: report.faultType,
            faultDescription: report.faultDescription,
            location: report.location, // זה כבר אובייקט JSON שנשמר
            media: report.media,
            timestamp: report.timestamp ? report.timestamp.toISOString() : null, // המר ל-ISO string
            createdBy: report.createdBy,
            creatorId: report.creatorId,
            status: report.status
        }));
        res.json(formattedReports);
    } catch (e) {
        console.error('Error fetching reports from MongoDB:', e.message);
        res.status(500).json({ message: 'Failed to load reports.' });
    }
});

// --- הגשת קבצים סטטיים ---
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/uploads', express.static(uploadDir));

// --- ניתוב לדף הבית הראשי ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// --- ניתובים לדפי HTML ספציפיים בתוך client/html ---
app.get('/html/:pageName', (req, res) => {
    const pageName = req.params.pageName;
    const filePath = path.join(__dirname, '..', 'client', 'html', pageName);
    res.sendFile(`${filePath}.html`, (err) => {
        if (err) {
            console.error(`Error serving ${filePath}.html:`, err);
            res.status(404).send('Page not found');
        }
    });
});

// --- הפעלת השרת ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`CORS_ORIGIN set to: ${process.env.CORS_ORIGIN || '*'}`);
    if (process.env.MONGO_URL) {
        console.log('MongoDB URL is set (connecting to external DB).');
    } else {
        console.warn('MONGO_URL is NOT set. Ensure it is defined for production deployment.');
    }
});
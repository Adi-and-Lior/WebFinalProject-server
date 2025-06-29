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
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log('Connected to MongoDB database.'))
.catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1); // יציאה מהאפליקציה אם החיבור נכשל
});

// סכימת משתמש (User Schema)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userType: { type: String, required: true },
    city: { type: String }, // <--- חדש: הוספת שדה עיר למשתמש
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// סכימת דיווח (Report Schema)
const reportSchema = new mongoose.Schema({
    faultType: { type: String, required: true },
    faultDescription: { type: String },
    location: { // אובייקט JSON לנתוני מיקום
        type: { type: String, required: true }, // 'manual' or 'current'
        city: { type: String, required: true }, // <--- וודא שעיר קיימת וחובה
        street: { type: String },
        houseNumber: { type: String },
        latitude: { type: Number },
        longitude: { type: Number }
    },
    media: { type: String }, // שם הקובץ שהועלה (נשמר אפמרית)
    timestamp: { type: Date, default: Date.now },
    createdBy: { type: String },
    creatorId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' }, 
    status: { type: String, default: 'in-progress' },
    municipalityResponse: { type: String, default: null } 
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
app.post('/api/login', async (req, res) => {
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
                    userId: foundUser._id,
                    city: foundUser.city // <--- חדש: החזר את עיר המשתמש בלוגין
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
app.post('/api/register', async (req, res) => {
    const { username, password, userType, city } = req.body; // <--- חדש: קבל גם עיר

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
            city, // <--- חדש: שמור את העיר
        });

        await newUser.save(); // שמירה ל-MongoDB
        console.log(`New user registered: ${username} (${userType}, City: ${city}) with ID: ${newUser._id}`);
        res.status(201).json({ user: { username, userType, userId:newUser._id, city: newUser.city } }); // <--- חדש: החזר את העיר גם ברישום
    } catch (error) {
        console.error('Error registering new user:', error.message);
        res.status(500).json({ error: 'שגיאה בעת הרשמת משתמש חדש.' });
    }
});

// נקודת קצה לקבלת רשימת משתמשים (ללא סיסמאות)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username userType _id city'); // <--- חדש: הוסף city לשליפה
        const publicUsers = users.map(user => ({
            id: user._id.toString(), 
            username: user.username,
            userType: user.userType,
            city: user.city // <--- חדש: החזר את העיר
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
        // וודא ששדה העיר קיים ב-parsedLocationDetails
        if (!parsedLocationDetails.city) {
            console.error("Location details missing city field.");
            return res.status(400).json({ message: 'Location details must include a city.' });
        }
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
            status: 'in-progress'
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

// --- נקודת קצה לקבלת דיווח בודד לפי ID ---
app.get('/api/reports/:id', async (req, res) => {
    try {
        const { id } = req.params; // קבל את ה-ID מפרמטרי ה-URL
        const report = await Report.findById(id); // חפש את הדיווח לפי ID ב-MongoDB

        if (!report) {
            // אם הדיווח לא נמצא, החזר שגיאת 404
            return res.status(404).json({ message: 'Report not found.' });
        }

        // אם הדיווח נמצא, החזר אותו בפורמט JSON
        const formattedReport = {
            id: report._id,
            faultType: report.faultType,
            description: report.faultDescription, // שינוי שם: ב-HTML השתמשת ב-displayDescription
            location: report.location,
            media: report.media,
            timestamp: report.timestamp ? report.timestamp.toISOString() : null,
            createdBy: report.createdBy,
            creatorId: report.creatorId,
            status: report.status,
            municipalityResponse: report.municipalityResponse || null // ודא ששדה זה קיים בסכימה או הוסף אותו
        };

        res.json(formattedReport);

    } catch (e) {
        console.error(`Error fetching report with ID ${req.params.id} from MongoDB:`, e.message);
        // אם ה-ID אינו תקין (למשל, לא פורמט ObjectId), Mongoose יזרוק שגיאה
        if (e.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Report ID format.' });
        }
        res.status(500).json({ message: 'Failed to load report details.' });
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

// --- נקודת קצה חדשה: קבלת דיווחים רלוונטיים לעובד לפי עיר ---
// נקודה זו מצפה לקבל את עיר העובד כפרמטר שאילתה, לדוגמה: /api/employee-reports?city=TelAviv
app.get('/api/employee-reports', async (req, res) => {
    try {
        const employeeCity = req.query.city; // קבל את העיר מפרמטרי השאילתה (query parameter)
        const statusFilter = req.query.status; // קבל את סטטוס הסינון (אם קיים)

        if (!employeeCity) {
            return res.status(400).json({ message: 'Missing employee city in query parameters.' });
        }

        let query = { 'location.city': employeeCity }; // שאילתה ראשונית: דיווחים עם העיר של העובד

        if (statusFilter && statusFilter !== 'all') { // אם יש פילטר סטטוס, הוסף לשאילתה
            query.status = statusFilter;
        }

        const reports = await Report.find(query).sort({ timestamp: -1 }); // שלוף דיווחים ומיון מהחדש לישן

        const formattedReports = reports.map(report => ({
            id: report._id,
            faultType: report.faultType,
            faultDescription: report.faultDescription,
            location: report.location,
            media: report.media,
            timestamp: report.timestamp ? report.timestamp.toISOString() : null,
            createdBy: report.createdBy,
            creatorId: report.creatorId,
            status: report.status
        }));
        res.json(formattedReports);
    } catch (e) {
        console.error('Error fetching employee-relevant reports from MongoDB:', e.message);
        res.status(500).json({ message: 'Failed to load employee-relevant reports.' });
    }
});


// --- הגשת קבצים סטטיים ---
// הנתיב לתיקייה הראשית של הקבצים הסטטיים שלך (client)
app.use(express.static(path.join(__dirname, '..', 'client')));
// הנתיב לתיקיית העלאות (uploads)
app.use('/uploads', express.static(uploadDir));

// --- ניתוב לדף הבית הראשי ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// --- ניתובים לדפי HTML ספציפיים בתוך client/html ---
app.get('/html/:pageName', (req, res) => {
    const pageName = req.params.pageName;
    const filePath = path.join(__dirname, '..', 'client', 'html', pageName);
    // חשוב! כאן אנחנו מגישים קובץ HTML, לא קובץ JS.
    // וודא שהנתיב לסקריפט בתוך ה-HTML נכון
    res.sendFile(filePath, (err) => { // הסרתי את ה-`.html` שנוסף פעמיים, וזה מה שגרם ל-404
        if (err) {
            console.error(`Error serving ${filePath}:`, err);
            res.status(404).send('Page not found');
        }
    });
});

// --- הפעלת השרת ---
app.listen(PORT, () => {
    console.log(`Server is running. External URL: ${process.env.RENDER_EXTERNAL_URL || 'N/A'}`);
    console.log(`CORS_ORIGIN set to: ${process.env.CORS_ORIGIN || '*'}`);
    if (process.env.MONGO_URL) {
        console.log('MongoDB URL is set (connecting to external DB).');
    } else {
        console.warn('MONGO_URL is NOT set. Ensure it is defined for production deployment.');
    }
});
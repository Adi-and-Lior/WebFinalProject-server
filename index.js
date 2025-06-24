// ייבוא ספריות
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');
const multer = require('multer');
const { Pool } = require('pg'); // ייבוא ספריית PostgreSQL

// לטעינת משתני סביבה מקובץ .env בפיתוח מקומי
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 3000; // פורט 3000 כברירת מחדל, או מוגדר ע"י הסביבה

// *** הגדרת Pool ל-PostgreSQL ***
// משתמש ב-DATABASE_URL ממשתני הסביבה (קובץ .env בפיתוח, או מ-Railway בפריסה)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false // SSL נדרש בדרך כלל בהפקה
});

// בדיקת חיבור לבסיס הנתונים
pool.connect((err, client, done) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        // יציאה מהתהליך אם אין חיבור לבסיס נתונים בהפקה (אופציונלי אך מומלץ)
        // if (process.env.NODE_ENV === 'production') process.exit(1);
    } else {
        console.log('Connected to PostgreSQL database.');
        client.release(); // שחרר את הלקוח בחזרה ל-pool
    }
});


// *** הגדרת CORS ***
// חשוב: בפריסה לאתר חי, וודא שאתה מחליף את "*" ב-URL של ה-Frontend הפרוס שלך.
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*', // השתמש במשתנה סביבה או ב-`*` כברירת מחדל
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


// --- נקודות הקצה של ה-API שלך (כעת עם PostgreSQL) ---

// נקודת קצה ללוגין
app.post('/api/login', async (req, res) => { // Updated to /api/login
    const { username, password, userType } = req.body;

    try {
        const result = await pool.query(
            'SELECT id, username, password, user_type FROM users WHERE username = $1 AND user_type = $2',
            [username, userType]
        );

        if (result.rows.length === 0) {
            console.log('Login failed: User not found or type mismatch.');
            return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
        }

        const foundUser = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, foundUser.password);

        if (passwordMatch) {
            console.log('Login successful.');
            res.status(200).json({
                message: 'Login successful',
                user: {
                    username: foundUser.username,
                    userType: foundUser.user_type, // שימו לב: user_type מ-DB
                    userId: foundUser.id
                }
            });
        } else {
            console.log('Login failed: Password mismatch.');
            res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
        }
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ error: 'שגיאת שרת פנימית.' });
    }
});

// נקודת קצה ליצירת משתמש חדש
app.post('/api/register', async (req, res) => { // Updated to /api/register
    const { username, password, userType } = req.body;

    try {
        // בדוק אם משתמש כבר קיים
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1 AND user_type = $2',
            [username, userType]
        );
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'משתמש עם שם משתמש וסוג זה כבר קיים.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // *** שינוי: יצירת ID מספרי למראה (כסטרינג) למשתמשים חדשים ***
        // ID פשוט וייחודי יותר מורכב ממספרים (חותמת זמן)
        const newId = Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // לדוגמה: "1678888888000123"

        const result = await pool.query(
            'INSERT INTO users (id, username, password, user_type) VALUES ($1, $2, $3, $4) RETURNING id, username, user_type',
            [newId, username, hashedPassword, userType]
        );
        const createdUser = result.rows[0];

        console.log(`New user registered: ${createdUser.username} (${createdUser.user_type}) with ID: ${createdUser.id}`);
        res.status(201).json({ user: { username: createdUser.username, userType: createdUser.user_type, userId: createdUser.id } });

    } catch (error) {
        console.error('Error registering new user:', error);
        res.status(500).json({ error: 'שגיאה בעת הרשמת משתמש חדש.' });
    }
});

// נקודת קצה לקבלת רשימת משתמשים (ללא סיסמאות)
app.get('/api/users', async (req, res) => { // Updated to /api/users
    try {
        const result = await pool.query('SELECT id, username, user_type FROM users');
        const publicUsers = result.rows.map(user => ({
            id: user.id,
            username: user.username,
            userType: user.user_type
        }));
        res.json(publicUsers);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Failed to load users.' });
    }
});


// --- נקודת קצה עבור שליחת דיווחים ---
app.post('/api/reports', upload.single('mediaFile'), async (req, res) => {
    // נתוני מיקום מגיעים כ-JSON string, יש לפרסר אותם
    let parsedLocationDetails = {};
    try {
        parsedLocationDetails = JSON.parse(req.body.locationDetails); // גישה ישירה ל-req.body
    } catch (e) {
        console.error("Error parsing locationDetails:", e);
        return res.status(400).json({ message: 'Invalid location details format.' });
    }

    const { faultType, faultDescription, locationType, uploadOption, createdBy, creatorId } = req.body;
    const uploadedFile = req.file;

    // הוצאת שדות מיקום מתוך parsedLocationDetails
    const {
        city = null,
        street = null,
        houseNumber = null,
        latitude = null,
        longitude = null
    } = parsedLocationDetails;

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
        const result = await pool.query(
            `INSERT INTO reports (
                fault_type, fault_description, location_type,
                location_details_city, location_details_street, location_details_house_number,
                location_details_latitude, location_details_longitude,
                media_file_name, created_by, creator_id, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
            [
                faultType,
                faultDescription,
                locationType,
                city,
                street,
                houseNumber,
                latitude,
                longitude,
                uploadedFile ? uploadedFile.filename : null,
                createdBy,
                creatorId,
                'pending' // סטטוס ראשוני
            ]
        );
        const newReportId = result.rows[0].id; // ה-ID שנוצר אוטומטית ע"י SERIAL

        console.log(`Report saved successfully with ID: ${newReportId}`);
        res.status(200).json({
            message: 'Report submitted successfully!',
            reportId: newReportId,
            mediaFileNameOnServer: uploadedFile ? uploadedFile.filename : null
        });
    } catch (err) {
        console.error('Error saving report to PostgreSQL:', err);
        res.status(500).json({ message: 'Failed to save report.' });
    }
});

// --- נקודת קצה לקבלת דיווחים (לצורך הצגה) ---
app.get('/api/reports', async (req, res) => {
    try {
        let queryText = 'SELECT * FROM reports';
        const queryParams = [];
        
        // בדוק אם נשלח creatorId כפרמטר שאילתה
        if (req.query.creatorId) {
            queryText += ' WHERE creator_id = $1'; // הוסף תנאי WHERE
            queryParams.push(req.query.creatorId); // הוסף את הערך לפרמטרים
        }

        queryText += ' ORDER BY timestamp DESC'; // מיון מהחדש לישן

        const result = await pool.query(queryText, queryParams);
        
        const reports = result.rows.map(row => ({
            id: row.id,
            faultType: row.fault_type,
            faultDescription: row.fault_description,
            location: { // בנה מחדש את אובייקט המיקום
                type: row.location_type,
                city: row.location_details_city,
                street: row.location_details_street,
                houseNumber: row.location_details_house_number,
                latitude: row.location_details_latitude,
                longitude: row.location_details_longitude
            },
            media: row.media_file_name, // שם הקובץ
            // המר Timestamp של PostgreSQL לתאריך/שעה נוחים לקריאה ב-JS
            timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : null,
            createdBy: row.created_by,
            creatorId: row.creator_id,
            status: row.status
        }));
        res.json(reports);
    } catch (e) {
        console.error('Error fetching reports from PostgreSQL:', e);
        res.status(500).json({ message: 'Failed to load reports.' });
    }
});

// --- הגשת קבצים סטטיים ---
// שרת את תיקיית ה-client כקבצים סטטיים (כולל ה-html, css, js files)
app.use(express.static(path.join(__dirname, '..', 'client')));
// שרת את תיקיית uploads כ- /uploads, כדי שקבצים שהועלו יהיו נגישים מהדפדפן
// הערה: אחסון זה אפמרי ב-Render. עבור פרויקט הפקה, תצטרך אחסון קבצים בענן.
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
    if (process.env.DATABASE_URL) {
        console.log('Database URL is set (connecting to external DB).');
    } else {
        console.warn('DATABASE_URL is NOT set. Ensure it is defined for production deployment.');
    }
});
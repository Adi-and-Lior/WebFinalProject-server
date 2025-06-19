const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs'); // ייבוא מודול fs לטיפול בקבצים
const multer = require('multer'); // ייבוא מודול multer לטיפול בהעלאת קבצים

const app = express();
const PORT = process.env.PORT || 3000;

const usersFilePath = path.join(__dirname, 'users.json'); // נתיב לקובץ users.json
// הנתיב לקובץ reports.json - מניח שהוא בתיקייה אחת מעל תיקיית server
const reportsFilePath = path.join(__dirname, '..', 'reports.json'); 

// --- הגדרת Multer לאחסון קבצים ---
// תיקיית uploads תהיה בתוך תיקיית server
const uploadDir = path.join(__dirname, 'uploads'); 
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // יצירת שם קובץ ייחודי עם חותמת זמן ושם הקובץ המקורי
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

let users = []; // משתנה גלובלי שיחזיק את המשתמשים בזיכרון

async function initializeUsers() {
    try {
        const data = await fs.promises.readFile(usersFilePath, 'utf8');
        users = JSON.parse(data);
        let usersUpdated = false;

        // עוברים על המשתמשים ומוסיפים ID אם חסר
        users = users.map(user => {
            if (!user.id) {
                user.id = generateUniqueId(users); // יצירת ID ייחודי
                usersUpdated = true;
            }
            return user;
        });

        if (usersUpdated) {
            await fs.promises.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
            console.log('users.json updated with new IDs.');
        } else {
            console.log('users.json loaded. All users have IDs.');
        }
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log('users.json not found. Creating an empty file.');
            users = []; // אתחל רשימת משתמשים ריקה
            await fs.promises.writeFile(usersFilePath, '[]', 'utf8');
        } else {
            console.error('Error initializing users file:', err);
        }
    }
}

// פונקציה ליצירת ID ייחודי
function generateUniqueId(existingUsers) {
    let newId;
    do {
        newId = Math.random().toString(36).substring(2, 15); // יוצר מחרוזת אלפאנומרית רנדומלית
    } while (existingUsers.some(user => user.id === newId)); // מוודא שה-ID ייחודי
    return newId;
}

// קריאה לפונקציית האתחול לפני הגדרת הניתובים והפעלת השרת
initializeUsers().then(() => {
    app.use(cors());
    app.use(express.json()); // חובה לקבלת JSON מגוף הבקשה

    // --- נקודות הקצה של ה-API שלך ---

    // נקודת קצה ללוגין
    app.post('/login', async (req, res) => {
        const { username, password, userType } = req.body;

        const foundUser = users.find(user =>
            user.username === username &&
            user.userType === userType
        );

        if (foundUser) {
            try {
                const passwordMatch = await bcrypt.compare(password, foundUser.password);

                if (passwordMatch) {
                    console.log('Login successful.');
                    res.status(200).json({ 
                        message: 'Login successful', 
                        user: { 
                            username: foundUser.username, 
                            userType: foundUser.userType, 
                            userId: foundUser.id 
                        } 
                    });
                } else {
                    console.log('Login failed.');
                    res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
                }
            } catch (err) {
                console.error('Error comparing password:', err);
                res.status(500).json({ error: 'שגיאת שרת פנימית.' });
            }
        } else {
            console.log('Login failed.');
            res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
        }
    });

    // נקודת קצה לדוגמה ליצירת משתמש חדש
    app.post('/register', async (req, res) => {
        const { username, password, userType } = req.body;

        if (users.some(user => user.username === username && user.userType === userType)) {
            return res.status(409).json({ error: 'משתמש עם שם משתמש וסוג זה כבר קיים.' });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10); // הצפנת הסיסמה
            const newId = generateUniqueId(users); // יצירת ID חדש למשתמש
            const newUser = {
                id: newId,
                username,
                password: hashedPassword,
                userType 
            };

            users.push(newUser); // הוספת המשתמש לרשימה בזיכרון

            // שמירת המשתמשים המעודכנים לקובץ
            await fs.promises.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
            console.log(`New user registered: ${username} (${userType}) with ID: ${newId}`);
            res.status(201).json({ user: { username, userType, userId: newId } });

        } catch (error) {
            console.error('Error registering new user:', error);
            res.status(500).json({ error: 'שגיאה בעת הרשמת משתמש חדש.' });
        }
    });

    app.get('/users', (req, res) => {
        // חשוב לא להחזיר סיסמאות!
        const publicUsers = users.map(user => ({ id: user.id, username: user.username, userType: user.userType }));
        res.json(publicUsers);
    });

    // --- נקודת קצה עבור שליחת דיווחים ---
    app.post('/api/reports', upload.single('mediaFile'), (req, res) => {
        const { faultType, faultDescription, locationType, manualAddress, uploadOption, createdBy, creatorId } = req.body;
        const uploadedFile = req.file; // Multer מטפל בהעלאת הקובץ ומספק את המידע כאן

        console.log('Received Report Data:');
        console.log('Fault Type:', faultType);
        console.log('Fault Description:', faultDescription);
        console.log('Location Type:', locationType);
        if (locationType === 'loc2') {
            console.log('Manual Address:', manualAddress);
        }
        console.log('Upload Option:', uploadOption);
        if (uploadedFile) {
            console.log('Uploaded File:', uploadedFile.filename, uploadedFile.path);
        }
        console.log('Created By:', createdBy);
        console.log('Creator ID:', creatorId);

        fs.readFile(reportsFilePath, 'utf8', (err, data) => {
            let reports = [];
            if (!err && data) {
                try {
                    reports = JSON.parse(data);
                } catch (e) {
                    console.error("Error parsing reports.json:", e);
                    fs.writeFile(reportsFilePath, '[]', 'utf8', (writeErr) => {
                        if (writeErr) console.error('Error overwriting corrupted reports.json:', writeErr);
                    });
                }
            }

            // חישוב ה-ID החדש לדיווח, תוך התחשבות במקרים שבהם מערך הדיווחים ריק
            const newReportId = reports.length > 0 ? Math.max(...reports.map(r => r.id)) + 1 : 1;

            const reportData = {
                id: newReportId,
                faultType: faultType,
                faultDescription: faultDescription,
                location: (locationType === 'loc1') ? 'מיקומך הנוכחי' : manualAddress,
                media: uploadedFile ? uploadedFile.filename : null, // שם הקובץ ש-Multer שמר
                timestamp: new Date().toISOString(),
                createdBy: createdBy,
                creatorId: creatorId,
                status: 'pending' // סטטוס ראשוני לדיווח חדש
            };

            reports.push(reportData);
            fs.writeFile(reportsFilePath, JSON.stringify(reports, null, 2), (err) => {
                if (err) {
                    console.error('Error writing report to file:', err);
                    return res.status(500).json({ message: 'Failed to save report.' });
                }
                console.log('Report saved successfully.');
                res.status(200).json({ message: 'Report submitted successfully!', reportId: newReportId });
            });
        });
    });

    // --- נקודת קצה לקבלת דיווחים (לצורך הצגה, למשל בדף העובד/אזרח) ---
    app.get('/api/reports', (req, res) => {
        fs.readFile(reportsFilePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading reports.json:', err);
                return res.status(500).json({ message: 'Failed to load reports.' });
            }
            try {
                const reports = JSON.parse(data);
                res.json(reports);
            } catch (e) {
                console.error('Error parsing reports.json:', e);
                res.status(500).json({ message: 'Failed to parse reports data.' });
            }
        });
    });

    // --- הגשת קבצים סטטיים ---
    // שרת את תיקיית ה-client כקבצים סטטיים (כולל ה-html, css, js files)
    app.use(express.static(path.join(__dirname, '..', 'client')));
    // שרת את תיקיית uploads כ- /uploads, כדי שקבצים שהועלו יהיו נגישים מהדפדפן
    app.use('/uploads', express.static(uploadDir)); 

    // --- ניתוב לדף הבית הראשי ---
    // אם השרת מגיש את index.html מתיקיית client
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
    });

    // --- ניתובים לדפי HTML ספציפיים בתוך client/html ---
    app.get('/html/:pageName', (req, res) => {
        const pageName = req.params.pageName;
        const filePath = path.join(__dirname, '..', 'client', 'html', pageName); // ללא .html כאן
        // וודא שאתה מגיש את הקובץ עם סיומת .html
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
    });

}).catch(error => {
    console.error("Failed to initialize server due to user data error:", error);
    process.exit(1); // יציאה מהתהליך אם יש שגיאה באתחול המשתמשים
});
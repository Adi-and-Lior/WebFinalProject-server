// server/seed.js (קובץ חדש - תריץ אותו רק פעם אחת!)

// ודא שאתה טוען את משתני הסביבה מהקובץ .env
// שים לב: זה צריך להיות לפני השימוש ב-process.env
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config(); // <-- הוספה: טעינת משתני סביבה
}

const mongoose = require('mongoose');
const FaultType = require('./models/FaultType'); // ייבוא המודל שוב

// רשימת סוגי התקלות שאתה רוצה להוסיף לדאטה בייס
const initialFaultTypes = [
    { value: "בור בכביש", label: "בור בכביש" },
    { value: "דליפת מים", label: "דליפת מים" },
    { value: "חוטי חשמל חשופים", label: "חוטי חשמל חשופים" },
    { value: "מפגע תברואתי", label: "מפגע תברואתי" },
    { value: "תאורת רחוב מקולקלת", label: "תאורת רחוב מקולקלת" },
    { value: "פח אשפה מלא", label: "פח אשפה מלא" },
    { value: "ונדליזם", label: "ונדליזם" },
    { value: "נזק לרכוש ציבורי", label: "נזק לרכוש ציבורי" },
    { value: "אחר", label: "אחר" }
];

async function seedFaultTypes() {
    console.log('Connecting to MongoDB for seeding...');
    // --- תיקון: שימוש במשתנה הסביבה MONGO_URL ---
    await mongoose.connect(process.env.MONGO_URL, { // <-- כאן!
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    console.log('MongoDB connected for seeding.');

    try {
        // מחיקת נתונים קיימים בקולקציה (אופציונלי, למנוע כפילויות בהרצה חוזרת)
        await FaultType.deleteMany({});
        console.log('Existing fault types cleared.');

        // הוספת הנתונים החדשים מהמערך initialFaultTypes
        await FaultType.insertMany(initialFaultTypes);
        console.log('Initial fault types added successfully!');
    } catch (error) {
        console.error('Error seeding fault types:', error);
    } finally {
        // ניתוק החיבור לדאטה בייס
        await mongoose.disconnect();
        console.log('MongoDB disconnected.');
    }
}

seedFaultTypes(); // הפעלת הפונקציה
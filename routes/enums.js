// server/routes/enums.js (קובץ קיים)

const express = require('express');
const router = express.Router();
const FaultType = require('../models/FaultType'); // <-- הוסף את השורה הזו (ודא נתיב נכון!)

// ה-FAULT_TYPES הקבוע שהיה לך - לא צריך אותו יותר!
// אתה יכול למחוק את כל הגדרת המערך הזה:
/*
const FAULT_TYPES = [
    { value: "בור בכביש", label: "בור בכביש" },
    { value: "דליפת מים", label: "דליפת מים" },
    // ... שאר סוגי התקלות
];
*/

// הגדרת נקודת הקצה: GET /api/fault-types
// הפוך את הפונקציה ל-async כי היא מבצעת פעולה אסינכרונית עם הדאטה בייס
router.get('/fault-types', async (req, res) => { // <-- הוסף async כאן
    try {
        // שלוף את סוגי התקלות מבסיס הנתונים באמצעות המודל:
        const faultTypes = await FaultType.find({}); // <-- שנה את השורה הזו!

        // שולח את רשימת סוגי התקלות שנשלפה מהדאטה בייס כתגובת JSON
        res.json(faultTypes);
    } catch (error) {
        console.error('Error fetching fault types from DB:', error.message); // <-- שינוי הודעת השגיאה
        res.status(500).json({ message: 'Failed to retrieve fault types from database.' });
    }
});

// ייצוא הראוטר
module.exports = router;
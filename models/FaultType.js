// server/models/FaultType.js  (קובץ חדש)

const mongoose = require('mongoose');

// הגדרת הסכמה (Schema) שמגדירה איך ייראה אובייקט "FaultType" בדאטה בייס
const faultTypeSchema = new mongoose.Schema({
    value: {
        type: String,
        required: true, // השדה הזה חייב להיות קיים
        unique: true   // הערך של השדה הזה חייב להיות ייחודי
    },
    label: {
        type: String,
        required: true  // השדה הזה חייב להיות קיים
    }
}, {
    timestamps: true // Mongoose יוסיף אוטומטית שדות createdAt ו-updatedAt
});

// יצירת המודל מתוך הסכמה וייצואו לשימוש בקבצים אחרים
module.exports = mongoose.model('FaultType', faultTypeSchema);
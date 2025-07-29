const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const User = require('../models/User');
const Report = require('../models/Report'); 
const { getCities } = require('./geo');

/* ---------- Handles requests to get a list of all users ---------- */
router.get('/users', async (_, res) => {
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

router.post('/register', async (req, res) => {
    try {
        const { username, password, role, employeeAuthCode } = req.body;

        if (!username || !password || !role) {
            return res.status(400).json({ message: 'חסרים פרטים בהרשמה.' });
        }

        // בדיקה אם המשתמש כבר קיים
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'המשתמש כבר קיים.' });
        }

        // הצפנת סיסמה
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            password: hashedPassword,
            role
        });

        // אם מדובר בעובד, נוסיף עיר לפי קוד גישה
        if (role === 'employee') {
            const cities = getCities(); // טוען את הערים מהזיכרון
            const matchedCity = cities.find(city => city.authCode === employeeAuthCode);

            if (!matchedCity) {
                return res.status(403).json({ message: 'קוד גישה לא חוקי לעובד. לא נמצאה עיר מתאימה.' });
            }

            newUser.city = matchedCity.name; // נניח ששם העיר נמצא תחת name
        }

        await newUser.save();
        res.status(201).json({ message: 'המשתמש נרשם בהצלחה.' });

    } catch (err) {
        console.error('שגיאה בהרשמה:', err.message);
        res.status(500).json({ message: 'שגיאה בשרת בהרשמה.' });
    }
});

/* ---------- Handles requests to delete a user and all their associated reports ---------- */
router.delete('/users/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const deleteReportsResult = await Report.deleteMany({ creatorId: userId });
    console.log(`Deleted ${deleteReportsResult.deletedCount} reports for user ${userId}.`);
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

module.exports = router;
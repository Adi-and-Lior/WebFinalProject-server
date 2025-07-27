const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User'); 

/* ---------- Handles user login requests ---------- */
router.post('/login', async (req, res) => {
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

/* ---------- Handles new user registration requests ---------- */
router.post('/register', async (req, res) => {
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

module.exports = router;
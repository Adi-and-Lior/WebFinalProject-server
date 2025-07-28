const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User'); 
const jwt = require('jsonwebtoken');

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
    const token = jwt.sign(
        { userId: foundUser._id, userType: foundUser.userType }, 
        process.env.JWT_SECRET,                             
        { expiresIn: '1h' }                                 
    );
    res.json({
      message: 'Login successful',
      token: token,
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

module.exports = router;
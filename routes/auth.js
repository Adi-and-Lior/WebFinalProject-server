/* ---------- Imports ---------- */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');                // For secure password comparison
const User = require('../models/User');         // Mongoose User model
const jwt = require('jsonwebtoken');            // For creating JWT tokens

/* ---------- Handles user login requests ---------- */
router.post('/login', async (req, res) => {
  const { username, password, userType } = req.body; // Extract login credentials and type from request

  try {
    /* ---------- Searches for a user with matching username and userType ---------- */
    const foundUser = await User.findOne({ username, userType });

    /* ---------- If no such user exists, return an error ---------- */
    if (!foundUser) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
    }

    /* ---------- Compares entered password with stored (hashed) password ---------- */
    const ok = await bcrypt.compare(password, foundUser.password);

    /* ---------- If password doesn't match, return an error ---------- */
    if (!ok) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים.' });
    }

    /* ---------- Creates JWT token with user ID and type, expires in 1 hour ---------- */
    const token = jwt.sign(
        { userId: foundUser._id, userType: foundUser.userType }, 
        process.env.JWT_SECRET, // Secret key from environment variables
        { expiresIn: '1h' }     // Token validity duration
    );

    /* ---------- Responds with token and basic user info (excluding password) ---------- */
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
    /* ---------- Handles server errors ---------- */
    console.error('Error during login:', err.message);
    res.status(500).json({ error: 'שגיאת שרת פנימית.' });
  }
});

/* ---------- Exports the router to be used in the main server ---------- */
module.exports = router;

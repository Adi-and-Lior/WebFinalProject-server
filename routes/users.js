const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const User = require('../models/User');
const Report = require('../models/Report'); 
const { getCities } = require('../utils/geoDataHelper');

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
    console.error('Error fetching users:', err.message);  /* ---------- Professional log for failure to fetch users ---------- */
    res.status(500).json({ message: 'Failed to load users.' });
  }
});

/* ---------- Handles user registration requests ---------- */
router.post('/register', async (req, res) => {
    try {
        console.log('🔹 Received POST request for user registration');  /* ---------- Clear log indicating registration request ---------- */
        console.log('📦 Received data:', req.body);
        const { username, password, userType, city: employeeAuthCode } = req.body;

        if (!username || !password || !userType) {
            return res.status(400).json({ message: 'Missing registration details.' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already exists.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            password: hashedPassword,
            userType
        });
        if (userType === 'employee') {
            const cities = getCities();
            const matchedCity = cities.find(city => city.trim() === employeeAuthCode.trim()); 
            if (!matchedCity) {
                return res.status(403).json({ message: 'Invalid employee authorization code.' });
            }
            newUser.city = matchedCity.trim();
        }

        await newUser.save();
        res.status(201).json({ message: 'User registered successfully.' });

    } catch (err) {
        console.error('Error during registration:', err.message);  /* ---------- Professional error log for registration failure ---------- */
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

/* ---------- Handles requests to delete a user and all their associated reports ---------- */
router.delete('/users/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const deleteReportsResult = await Report.deleteMany({ creatorId: userId });
    console.log(`Deleted ${deleteReportsResult.deletedCount} reports for user ${userId}.`);  /* ---------- Logs number of deleted reports for traceability ---------- */
    const deleteUserResult = await User.findByIdAndDelete(userId);
    if (!deleteUserResult) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ message: 'User account and related reports deleted successfully.' });
  } catch (err) {
    console.error('Error deleting user and their reports:', err.message);  /* ---------- Professional error log for deletion failure ---------- */
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID format.' });
    }
    res.status(500).json({ message: 'Server error during account deletion.' });
  }
});

module.exports = router;

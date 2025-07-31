/* ---------- Import Mongoose to define schema and model ---------- */
const mongoose = require('mongoose');

/* ---------- Defines the Mongoose schema for a user document ---------- */
const userSchema = new mongoose.Schema({
  username : { type: String, required: true, unique: true }, // Unique username for login
  password : { type: String, required: true },               // Hashed password
  userType : { type: String, required: true },               // Type of user: e.g., 'citizen' or 'employee'
  
  /* ---------- City is required only if userType is 'employee' ---------- */
  city     : {
    type    : String,
    required() {
      return (this.userType || '').toLowerCase() === 'employee';
    }
  },

  createdAt: { type: Date, default: Date.now } // Timestamp for account creation
});

/* ---------- Creates the Mongoose model for User, based on the userSchema ---------- */
const User = mongoose.model('User', userSchema);

/* ---------- Exports the User model for use in other parts of the application ---------- */
module.exports = User;

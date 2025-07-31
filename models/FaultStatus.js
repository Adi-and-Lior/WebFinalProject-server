/* ---------- Import Mongoose library for defining MongoDB schemas ---------- */
const mongoose = require('mongoose');

/* ---------- Define schema for fault status, including internal value and display name ---------- */
const FaultStatusSchema = new mongoose.Schema({
  value: { 
    type: String, 
    required: true, 
    unique: true 
  }, // Internal identifier (e.g., "in-progress", "completed", "rejected")

  name: { 
    type: String, 
    required: true 
  } // Display name in Hebrew (e.g., "בטיפול", "הושלם", "נדחה")
});

/* ---------- Export the Mongoose model for the FaultStatus collection ---------- */
module.exports = mongoose.model('FaultStatus', FaultStatusSchema);

/* ---------- Import Mongoose to define a schema ---------- */
const mongoose = require('mongoose');

/* ---------- Define the schema for a location option ---------- */
const locationOptionSchema = new mongoose.Schema({
  value: { 
    type: String, 
    required: true   // Technical identifier used in the system
  },
  label: { 
    type: String, 
    required: true   // Human-readable name shown to users
  }
});

/* ---------- Export the LocationOption model ---------- */
module.exports = mongoose.model('LocationOption', locationOptionSchema);

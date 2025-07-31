/* ---------- Import Mongoose to define schema and model ---------- */
const mongoose = require('mongoose');

/* ---------- Defines the Mongoose schema for a report document ---------- */
const reportSchema = new mongoose.Schema({
  faultType           : { type: String, required: true },        // Type of fault reported (value from predefined list)
  faultDescription    : { type: String },                         // Optional free-text description by user
  location            : {                                         // Nested object for geographic and address details
    type        : { type: String, required: true },               // e.g., "exact", "approximate"
    city        : { type: String, required: true },               // Name of the city
    street      : { type: String },                               // Street name (optional)
    houseNumber : { type: String },                               // House/building number (optional)
    latitude    : { type: Number },                               // Geographic latitude (optional)
    longitude   : { type: Number }                                // Geographic longitude (optional)
  },
  media               : { type: mongoose.Schema.Types.ObjectId, default: null },  // Reference to a media file (stored in separate collection or buffer)
  mediaMimeType       : { type: String, default: null },          // MIME type (e.g., image/png, video/mp4)
  timestamp           : { type: Date, default: Date.now },        // Date and time of report creation
  createdBy           : { type: String },                         // Name or identifier of the user (for display)
  creatorId           : {                                         // Reference to the User document (for permissions, etc.)
    type: mongoose.Schema.Types.ObjectId, 
    required: true, 
    ref: 'User' 
  },
  status              : { type: String, default: 'in-progress' }, // Report status (e.g., in-progress, completed, rejected)
  municipalityResponse: { type: String, default: null }           // Response from municipal worker (if any)
});

/* ---------- Creates the Mongoose model for Report, based on the reportSchema ---------- */
const Report = mongoose.model('Report', reportSchema);
module.exports = Report;

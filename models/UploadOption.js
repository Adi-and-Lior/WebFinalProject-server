/* ---------- Import Mongoose to define schema and model ---------- */
const mongoose = require('mongoose');

/* ---------- Defines the schema for an upload option (e.g., image, video, etc.) ---------- */
const uploadOptionSchema = new mongoose.Schema({
  value: { type: String, required: true },  // The internal value used in the system (e.g., "image", "video")
  label: { type: String, required: true }   // The user-friendly label shown in the UI (e.g., "תמונה", "וידאו")
});

/* ---------- Creates and exports the UploadOption model ---------- */
module.exports = mongoose.model('UploadOption', uploadOptionSchema);

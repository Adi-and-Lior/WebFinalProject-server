const mongoose = require('mongoose');

const uploadOptionSchema = new mongoose.Schema({
  value: { type: String, required: true },
  label: { type: String, required: true }
});

module.exports = mongoose.model('UploadOption', uploadOptionSchema);

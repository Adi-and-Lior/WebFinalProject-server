const mongoose = require('mongoose');

const locationOptionSchema = new mongoose.Schema({
  value: { type: String, required: true },
  label: { type: String, required: true }
});

module.exports = mongoose.model('LocationOption', locationOptionSchema);

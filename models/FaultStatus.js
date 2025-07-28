const mongoose = require('mongoose');

const FaultStatusSchema = new mongoose.Schema({
  value: { type: String, required: true, unique: true },  // in-progress, completed, rejected
  name: { type: String, required: true }                   // בטיפול, הושלם, נדחה
});

module.exports = mongoose.model('FaultStatus', FaultStatusSchema);

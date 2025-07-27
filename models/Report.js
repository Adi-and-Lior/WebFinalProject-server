const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  faultType           : { type: String, required: true },
  faultDescription    : { type: String },
  location            : {
    type        : { type: String, required: true },
    city        : { type: String, required: true },
    street      : { type: String },
    houseNumber : { type: String },
    latitude    : { type: Number },
    longitude   : { type: Number }
  },
  media               : { type: mongoose.Schema.Types.ObjectId, default: null },
  mediaMimeType       : { type: String, default: null },
  timestamp           : { type: Date, default: Date.now },
  createdBy           : { type: String },
  creatorId           : { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  status              : { type: String, default: 'in-progress' },
  municipalityResponse: { type: String, default: null }
});
const Report = mongoose.model('Report', reportSchema);
module.exports = Report;
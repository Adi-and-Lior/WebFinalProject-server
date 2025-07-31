/* ---------- Import Mongoose library to define a schema ---------- */
const mongoose = require('mongoose');

/* ---------- Define the schema for fault types ---------- */
const faultTypeSchema = new mongoose.Schema({
    value: {
        type: String,
        required: true,    // Must be provided
        unique: true       // Must be unique across the collection
    },
    label: {
        type: String,
        required: true     // Human-readable label (e.g., for UI display)
    }
}, {
    timestamps: true       // Automatically adds createdAt and updatedAt fields
});

/* ---------- Export the FaultType model based on the schema ---------- */
module.exports = mongoose.model('FaultType', faultTypeSchema);

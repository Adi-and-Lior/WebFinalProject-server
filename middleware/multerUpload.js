/* ---------- Import Multer library for handling multipart/form-data ---------- */
const multer = require('multer');

/* ---------- Configure Multer to store uploaded files in memory as Buffer objects ---------- */
const storage = multer.memoryStorage();

/* ---------- Initialize Multer middleware with memory storage ---------- */
const upload = multer({ storage });

/* ---------- Export the configured Multer upload middleware ---------- */
module.exports = upload;

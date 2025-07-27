const multer = require('multer');

/* ---------- Configures storage for Multer to keep files in memory as Buffers ---------- */
const storage = multer.memoryStorage();

/* ---------- Initializes Multer with the configured memory storage ---------- */
const upload = multer({ storage });

module.exports = upload;
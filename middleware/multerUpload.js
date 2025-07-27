const multer = require('multer');

/* ---------- File uploads (with GridFS) ---------- */
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = upload;
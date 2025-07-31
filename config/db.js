/* ---------- Importing Mongoose library ---------- */
const mongoose = require('mongoose');

/* ---------- GridFS bucket placeholder ---------- */
let bucket = null;

/* ---------- Connect to MongoDB using the connection string from environment variables ---------- */
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log('[MongoDB] Successfully connected to the database.'))
  .catch(err => {
    console.error('[MongoDB] Connection error:', err.message);
    process.exit(1); // Exit the process if connection fails
  });

/* ---------- Initialize GridFSBucket once the MongoDB connection is open ---------- */
mongoose.connection.once('open', () => {
  bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads' // Bucket name used for storing files
  });
  console.log('[MongoDB] GridFSBucket initialized with bucket name: "uploads".');
});

/* ---------- Export mongoose instance, GridFS bucket getter, and connection object ---------- */
module.exports = {
  mongoose,
  bucket: () => bucket,
  mongooseConnection: mongoose.connection
};

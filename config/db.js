const mongoose = require('mongoose');

let bucket;

/* ---------- MongoDB ---------- */
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log('Connected to MongoDB database.'))
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
mongoose.connection.once('open', () => {
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
    });
    console.log('GridFSBucket initialized.');
});

///////////////////////////////////////////////////////////
module.exports = {
  mongoose, // אם תצטרך גישה לאובייקט mongoose עצמו במקומות אחרים
  bucket // ייצוא ה-GridFSBucket
};
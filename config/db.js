const mongoose = require('mongoose');

let bucket = null;

/* ---------- Connects to the MongoDB database ---------- */
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log('Connected to MongoDB database.'))
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });

/* ---------- Initializes GridFSBucket for file storage upon successful MongoDB connection ---------- */
mongoose.connection.once('open', () => {
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
    });
    console.log('GridFSBucket initialized.');
});

module.exports = {
  mongoose, 
  bucket: () => bucket, 
  mongooseConnection: mongoose.connection 
};
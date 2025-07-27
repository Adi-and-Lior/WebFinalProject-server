const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username : { type: String, required: true, unique: true },
  password : { type: String, required: true },
  userType : { type: String, required: true },
  city     : {
    type    : String,
    required() {
      return (this.userType || '').toLowerCase() === 'employee';
    }
  },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);
module.exports = User;
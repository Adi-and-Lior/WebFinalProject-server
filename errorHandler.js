// errorHandler.js
module.exports = function (err, req, res, next) {
  console.error(err); // print the stack trace to console for debugging
  res.status(500).json({ error: 'Something went wrong on the server.' });
};

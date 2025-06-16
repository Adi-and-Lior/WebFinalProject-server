// validateTask.js
module.exports = function (req, res, next) {
  const { title, status } = req.body;

  // Title: required, non-empty string
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required and must be a non-empty string.' });
  }

  // Status: must be one of these three
  const validStatuses = ['pending', 'in-progress', 'done'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}.` });
  }
  next();
};

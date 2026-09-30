const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error(err.stack);

  if (err.name === 'CastError') {
    error.message = 'Resource not found';
    return res.status(404).json({ success: false, message: error.message });
  }
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {}).join(', ');
    error.message = fields ? `Duplicate value entered for ${fields} field` : 'Duplicate field value entered';
    return res.status(400).json({ success: false, message: error.message });
  }
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }
  if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File size cannot exceed 5MB'
        : err.message || 'File upload error';
    return res.status(400).json({ success: false, message });
  }
  if (err.message === 'Only images are allowed') {
    return res.status(400).json({ success: false, message: err.message });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
  });
};

module.exports = { errorHandler };


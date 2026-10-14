const env = require("../config/env");

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    stack: env.NODE_ENV === "production" ? undefined : err.stack,
  });
};

module.exports = errorHandler;
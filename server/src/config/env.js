require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",

  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",

  DATABASE_URL: process.env.DATABASE_URL,

  JWT_SECRET: process.env.JWT_SECRET || "your_jwt_secret_key",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
};
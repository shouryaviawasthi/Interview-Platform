const { Server } = require('socket.io');
const env = require('../config/env');
const logger = require('../config/logger');
const registerInterviewEvents = require("./interview.socket");

let io;

/**
 * Initialize Socket.IO
 */
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (origin === env.CLIENT_URL) return true;
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) return true;
  if (origin.includes("ngrok") || origin.includes("vercel.app") || origin.includes("onrender.com") || origin.includes("railway.app")) return true;
  if (env.NODE_ENV !== "production") return true;
  return false;
};

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          return callback(null, true);
        }
        logger.warn(`[Socket CORS] Origin rejected: ${origin}`);
        return callback(new Error(`CORS origin not allowed: ${origin}`), false);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  registerInterviewEvents(io);

  return io;
};

/**
 * Get Socket.IO instance
 */
const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized.");
  }

  return io;
};

module.exports = {
  initializeSocket,
  getIO,
};
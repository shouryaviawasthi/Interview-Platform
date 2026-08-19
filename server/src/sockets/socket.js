const { Server } = require('socket.io');
const env = require('../config/env');
const logger = require('../config/logger');
const registerInterviewEvents = require("./interview.socket");

let io;

/**
 * Initialize Socket.IO
 */
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
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
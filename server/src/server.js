const http = require("http");

const app = require("./app");
const env = require("./config/env");
const logger = require("./config/logger");
const { initializeSocket } = require("./sockets/socket");
const { connectDB } = require("./config/db");

const startServer = async () => {
  try {
    // Connect to Database
    await connectDB();

    // Create HTTP Server
    const server = http.createServer(app);

    // Initialize Socket.IO
    initializeSocket(server);

    // Start Server
    server.listen(env.PORT, () => {
      logger.info(
        `🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`
      );
    });

  } catch (error) {
    logger.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
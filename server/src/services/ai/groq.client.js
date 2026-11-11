const Groq = require("groq-sdk");
const env = require("../../config/env");
const logger = require("../../config/logger");

if (!env.GROQ_API_KEY) {
  // Don't crash the server on boot — a missing key only matters once
  // someone actually tries to transcribe/analyze — but make it loud so
  // it's obvious in the logs why those calls will fail.
  logger.warn(
    "GROQ_API_KEY is not set. Live transcription and AI analysis will fail until it's added to server/.env"
  );
}

const groq = new Groq({
  apiKey: env.GROQ_API_KEY || "missing-groq-api-key",
});

module.exports = groq;

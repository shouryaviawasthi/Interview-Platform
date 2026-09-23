const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const AUDIO_DIR = path.join(__dirname, "..", "uploads", "audio");

// Ensure the directory exists at startup
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AUDIO_DIR);
  },
  filename: (req, file, cb) => {
    // Determine extension from MIME type (browsers may send audio/webm, audio/ogg, audio/mp4)
    const mimeToExt = {
      "audio/webm": ".webm",
      "audio/ogg": ".ogg",
      "audio/mp4": ".mp4",
      "audio/mpeg": ".mp3",
      "audio/wav": ".wav",
    };
    const ext = mimeToExt[file.mimetype] || ".webm";
    cb(null, `interview-${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported audio format: ${file.mimetype}. Allowed: webm, ogg, mp4, mpeg, wav`), false);
  }
};

const audioUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

module.exports = audioUpload;

const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams: allows :id from parent

const transcriptController = require("../controllers/transcript.controller");
const { protect } = require("../middleware/auth.middleware");
const audioUpload = require("../middleware/audio.upload.middleware");

// Audio upload
router.post("/audio", protect, audioUpload.single("audio"), transcriptController.uploadAudio);

// Transcript retrieval
router.get("/transcript", protect, transcriptController.getTranscript);

// Retry failed transcription
router.post("/transcript/retry", protect, transcriptController.retryTranscript);

// Manual speaker assignment
router.post("/transcript/assign-speakers", protect, transcriptController.assignSpeakers);

module.exports = router;

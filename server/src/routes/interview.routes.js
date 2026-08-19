const express = require("express");
const router = express.Router();

const interviewController = require("../controllers/interview.controller");
const { protect } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");

// ─── Public Routes ────────────────────────────────────────────────────
// Candidate joins by token — no auth needed
router.get("/join/:token", interviewController.joinInterview);

// ─── Protected Routes ──────────────────────────────────────────────────
// Dashboard stats (must be before /:id to avoid clash)
router.get("/dashboard", protect, interviewController.getDashboard);

// CRUD
router.post("/",     protect, interviewController.createInterview);
router.get("/",      protect, interviewController.getAllInterviews);
router.get("/:id",   protect, interviewController.getInterviewById);
router.put("/:id",   protect, interviewController.updateInterview);
router.delete("/:id",protect, interviewController.deleteInterview);

// Resume upload
router.post("/:id/resume", protect, upload.single("resume"), interviewController.uploadResume);

module.exports = router;

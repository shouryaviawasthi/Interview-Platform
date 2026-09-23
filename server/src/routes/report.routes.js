const express = require("express");
const router = express.Router({ mergeParams: true });

const reportController = require("../controllers/report.controller");
const { protect } = require("../middleware/auth.middleware");

// Generate both reports (fire-and-forget, returns 202)
router.post("/reports/generate", protect, reportController.generateReports);

// Get individual reports
router.get("/candidate-report",   protect, reportController.getCandidateReport);
router.get("/interviewer-report",  protect, reportController.getInterviewerReport);

// Download PDF reports
router.get("/reports/candidate/pdf", protect, reportController.downloadCandidatePdf);
router.get("/reports/interviewer/pdf", protect, reportController.downloadInterviewerPdf);

// Retry failed reports
router.post("/reports/retry", protect, reportController.retryReports);

module.exports = router;


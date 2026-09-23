const express = require("express");

const healthRoutes      = require("./health.routes");
const authRoutes        = require("./auth.routes");
const interviewRoutes   = require("./interview.routes");
const transcriptRoutes  = require("./transcript.routes");
const reportRoutes      = require("./report.routes");
const analyticsRoutes   = require("./analytics.routes");

const router = express.Router();

router.use("/health",              healthRoutes);
router.use("/auth",                authRoutes);
router.use("/interviews",          interviewRoutes);
// Mounted under /interviews/:id — all use mergeParams
router.use("/interviews/:id",      transcriptRoutes);
router.use("/interviews/:id",      reportRoutes);
router.use("/interviews/:id",      analyticsRoutes);

// ── Public candidate report access (no auth) — via join token ──────────────
const { publicGetCandidateReport, publicDownloadCandidatePdf } = require("../controllers/report.controller");
router.get("/interviews/public/:token/candidate-report",      publicGetCandidateReport);
router.get("/interviews/public/:token/candidate-report/pdf",  publicDownloadCandidatePdf);

module.exports = router;
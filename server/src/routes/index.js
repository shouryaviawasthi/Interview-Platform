const express = require("express");

const healthRoutes    = require("./health.routes");
const authRoutes      = require("./auth.routes");
const interviewRoutes = require("./interview.routes");

const router = express.Router();

router.use("/health",     healthRoutes);
router.use("/auth",       authRoutes);
router.use("/interviews", interviewRoutes);

module.exports = router;
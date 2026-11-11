const express = require("express");
const router = express.Router({ mergeParams: true });

const analyticsController = require("../controllers/analytics.controller");
const { protect } = require("../middleware/auth.middleware");

// GET analytics data
router.get("/analytics", protect, analyticsController.getAnalytics);

// POST trigger analytics generation
router.post("/analytics/generate", protect, analyticsController.generateAnalytics);

// POST retry analytics generation
router.post("/analytics/retry", protect, analyticsController.retryAnalytics);

module.exports = router;

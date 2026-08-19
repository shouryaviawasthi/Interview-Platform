const express = require("express");

const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * Register User
 */
router.post("/register", authController.registerUser);
router.post("/login",    authController.loginUser);
router.get("/me",        protect, authController.getMe);  // Protected — verify token here

module.exports = router;
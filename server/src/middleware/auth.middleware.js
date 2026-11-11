const { verifyToken } = require("../utils/jwt");

/**
 * JWT Authentication Middleware
 * Protects routes that require a logged-in user.
 * Expects: Authorization: Bearer <token>
 */
const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    // Attach the decoded user payload to req.user
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized. Token is invalid or expired.",
    });
  }
};

module.exports = { protect };

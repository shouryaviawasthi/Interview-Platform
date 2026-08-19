const authService = require("../services/auth/auth.service");
const { findUserById } = require("../models/user.model");

const registerUser = async (req, res, next) => {
    try {
        const result = await authService.registerUser(req.body);

        res.status(201).json({
            success: true,
            data: result,
        });

    } catch (error) {
        next(error);
    }
};

const loginUser = async (req, res, next) => {
    try {
        const result = await authService.loginUser(req.body);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/auth/me
 * Returns the currently logged-in user's profile
 * req.user is set by the protect middleware
 */
const getMe = async (req, res, next) => {
    try {
        const user = await findUserById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    registerUser,
    loginUser,
    getMe,
};
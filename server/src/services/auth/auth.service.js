const userModel = require("../../models/user.model");
const { hashPassword, comparePassword } = require("../../utils/password");
const { generateToken } = require("../../utils/jwt");

/**
 * Register User
 */
const registerUser = async (userData) => {
    const { name, email, password } = userData;

    // Validate Input
    if (!name || !email || !password) {
        throw new Error("Name, email and password are required");
    }

    // Check Existing User
    const existingUser = await userModel.findUserByEmail(email);

    if (existingUser) {
        throw new Error("User already exists");
    }

    // Hash Password
    const hashedPassword = await hashPassword(password);

    // Create User
    const user = await userModel.createUser({
        name,
        email,
        password: hashedPassword,
    });

    // Generate JWT
    const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
    });

    return {
        user,
        token,
    };
};

/**
 * Login User
 */
const loginUser = async (userData) => {
    const { email, password } = userData;

    // Validate Input
    if (!email || !password) {
        throw new Error("Email and password are required");
    }

    // Find User
    const user = await userModel.findUserByEmail(email);

    if (!user) {
        throw new Error("Invalid email or password");
    }

    // Compare Password
    const isPasswordValid = await comparePassword(
        password,
        user.password
    );

    if (!isPasswordValid) {
        throw new Error("Invalid email or password");
    }

    // Generate JWT
    const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
    });

    // Remove password before sending response
    delete user.password;

    return {
        user,
        token,
    };
};

module.exports = {
    registerUser,
    loginUser,
};
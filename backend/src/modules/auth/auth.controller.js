
import {
  signupUser,
  loginUser,
  getUserById
} from "./auth.service.js";

import generateToken from "../../utils/generateToken.js";

// ==========================================
// COOKIE OPTIONS
// ==========================================

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/"
};

// ==========================================
// SIGNUP
// ==========================================

export const signup = async (req, res, next) => {
  try {
    const user = await signupUser(req.body);

    const token = generateToken(user.id);

    res.cookie("locat_token", token, cookieOptions);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user
    });
  } catch (error) {
    if (
      error.message === "Email already registered" ||
      error.message === "Username already taken"
    ) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

// ==========================================
// LOGIN
// ==========================================

export const login = async (req, res, next) => {
  try {
    const user = await loginUser(req.body);

    const token = generateToken(user.id);

    res.cookie("locat_token", token, cookieOptions);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user
    });
  } catch (error) {
    if (error.message === "Invalid email or password") {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
};

// ==========================================
// GET CURRENT USER
// ==========================================

export const getMe = async (req, res, next) => {
  try {
    const user = await getUserById(req.user.userId);

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// LOGOUT
// ==========================================

export const logout = async (req, res) => {
  res.clearCookie("locat_token", {
    ...cookieOptions,
    maxAge: undefined
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
};

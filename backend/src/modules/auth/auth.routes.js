
import { Router } from "express";

import {
  signup,
  login,
  getMe,
  logout
} from "./auth.controller.js";

import {
  signupSchema,
  loginSchema
} from "./auth.validation.js";

import validate from "../../middlewares/validate.middleware.js";
import protect from "../../middlewares/auth.middleware.js";

const router = Router();

// Create account
router.post("/signup", validate(signupSchema), signup);

// Login
router.post("/login", validate(loginSchema), login);

// Get currently authenticated user
router.get("/me", protect, getMe);

// Logout
router.post("/logout", logout);

export default router;

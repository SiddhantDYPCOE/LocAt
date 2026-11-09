
import prisma from "../../db.js";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

// ==========================================
// SIGNUP
// ==========================================

export const signupUser = async (userData) => {
  const { name, username, email, password } = userData;

  // Check whether email or username already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { username }
      ]
    }
  });

  if (existingUser) {
    if (existingUser.email === email) {
      throw new Error("Email already registered");
    }

    if (existingUser.username === username) {
      throw new Error("Username already taken");
    }
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const user = await prisma.user.create({
    data: {
      name,
      username,
      email,
      passwordHash
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      avatarUrl: true,
      bio: true,
      createdAt: true
    }
  });

  return user;
};

// ==========================================
// LOGIN
// ==========================================

export const loginUser = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  // Never return passwordHash
  const { passwordHash, ...safeUser } = user;

  return safeUser;
};

// ==========================================
// GET CURRENT USER
// ==========================================

export const getUserById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      avatarUrl: true,
      bio: true,
      createdAt: true
    }
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};


import api from "./api.js";

const authService = {
  // Register a new user
  signup: async (userData) => {
    const response = await api.post("/auth/signup", userData);
    return response.data;
  },

  // Login existing user
  login: async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    return response.data;
  },

  // Get currently authenticated user
  getMe: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },

  // Logout user
  logout: async () => {
    const response = await api.post("/auth/logout");
    return response.data;
  }
};

export default authService;

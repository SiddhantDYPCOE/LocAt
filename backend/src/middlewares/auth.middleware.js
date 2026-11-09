
import jwt from "jsonwebtoken";

const protect = (req, res, next) => {
  try {
    let token;

    // Prefer the Bearer token (Android).
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      // Fall back to the HTTP-only cookie (Web).
      token = req.cookies?.locat_token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in."
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      userId: decoded.userId
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token."
    });
  }
};

export default protect;

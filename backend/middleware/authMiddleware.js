const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    // 1. Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 2. Fetch the user and include currentSessionId for comparison
    const user = await User.findById(decoded.id).select("_id role currentSessionId");
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // 3. CONCURRENT LOGIN CHECK 🔥
    // Compare the sessionId from the token with the one in the database.
    if (user.currentSessionId !== decoded.sessionId) {
      return res.status(401).json({ 
        message: "Your account is logged in on another device. Please login again.",
        code: "CONCURRENT_LOGIN" // Frontend can use this code to trigger an automatic logout
      });
    }

    // 4. Attach user info to request
    req.user = {
      id: user._id,
      role: user.role
    };

    next();
  } catch (error) {
    // Check if error is due to token expiration
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired. Please login again." });
    }
    res.status(401).json({ message: "Invalid token" });
  }
};
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  studentClass: String, // Add this line
  role: {
    type: String,
    enum: ["student", "admin"],
    default: "student"
  },
  currentSessionId: { type: String, default: null }, // 🔥 New Field
});

module.exports = mongoose.model("User", userSchema);
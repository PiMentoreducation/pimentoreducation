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
});

module.exports = mongoose.model("User", userSchema);
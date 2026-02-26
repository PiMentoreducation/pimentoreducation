const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/mailer");

// In-memory store for OTPs
let otpStore = {};

/* ================= 1. SEND OTP (For Registration) ================= */
const sendRegisterOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with 5-minute expiry
    otpStore[email.toLowerCase()] = { 
      otp, 
      expires: Date.now() + 300000 
    };

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #4CAF50;">PiMentor Verification</h2>
        <p>Your registration OTP is:</p>
        <h1 style="letter-spacing: 5px;">${otp}</h1>
        <p>This code expires in 5 minutes.</p>
      </div>
    `;

    const success = await sendEmail(email, "Verify your PiMentor Account", html);

    if (success) {
      res.json({ message: "OTP sent to email" });
    } else {
      res.status(500).json({ message: "Failed to send OTP. Check SMTP settings." });
    }
  } catch (error) {
    console.error("SEND OTP ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= 2. REGISTER (Consolidated) ================= */
const register = async (req, res) => {
  try {
    const { name, email, password, studentClass, otp } = req.body;

    if (!name || !email || !password || !otp) {
      return res.status(400).json({ message: "All fields and OTP are required" });
    }

    const normalizedEmail = email.toLowerCase();

    // Verify OTP Logic
    const record = otpStore[normalizedEmail];
    if (!record || record.otp !== otp || record.expires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      studentClass
    });

    await user.save();
    
    // Clear OTP from memory after successful registration
    delete otpStore[normalizedEmail];

    res.status(201).json({ message: "Registered successfully" });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= 3. LOGIN ================= */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= 4. FORGOT PASSWORD ================= */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.json({ message: "If email exists, a reset link was sent." });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `http://localhost:5000/api/auth/reset-password/${resetToken}`;
    const html = `<p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`;
    
    await sendEmail(email, "PiMentor | Password Reset Request", html);
    res.json({ message: "Reset link sent to your email." });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Export all functions clearly
module.exports = { 
  register, 
  login, 
  sendRegisterOTP, 
  forgotPassword 
};
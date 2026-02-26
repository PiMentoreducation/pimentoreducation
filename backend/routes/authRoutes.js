const express = require("express");
const router = express.Router();
const SibApiV3Sdk = require("@getbrevo/brevo"); // Ensure you ran 'npm install @getbrevo/brevo'
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// --- BREVO CONFIGURATION ---
let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
let apiKey = apiInstance.authentications["apiKey"];
apiKey.apiKey = process.env.BREVO_API_KEY;

// Temporary store for OTPs (In-memory)
// Note: For production, consider Redis, but this works for your current scale.
const otpStore = {};

// --- HELPER: SEND OTP VIA BREVO ---
const sendOTPEmail = async (email, otp) => {
  let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

  sendSmtpEmail.subject = "PiMentor: Your Verification Code";
  sendSmtpEmail.htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #4CAF50;">Welcome to PiMentor</h2>
        <p>Your OTP for account verification is:</p>
        <h1 style="letter-spacing: 5px; color: #333;">${otp}</h1>
        <p>This code is valid for <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
        <hr/>
        <p style="font-size: 0.8rem; color: #777;">PiMentor Educational Services, Gorakhpur</p>
      </body>
    </html>`;
  
  // CRITICAL: The "email" here must be the one you verified in your Brevo dashboard
  sendSmtpEmail.sender = { name: "PiMentor", email: process.env.GMAIL_USER }; 
  sendSmtpEmail.to = [{ email: email }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`OTP sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error("Brevo API Error:", error.response ? error.response.body : error.message);
    throw new Error("Failed to send email via Brevo");
  }
};

// --- ROUTE: SEND OTP ---
router.post("/send-otp", async (req, res) => {
  const { email, type } = req.body;

  try {
    // Basic validation
    if (!email) return res.status(400).json({ message: "Email is required" });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with 10-minute expiry
    otpStore[email] = {
      otp,
      expires: Date.now() + 10 * 60 * 1000,
    };

    await sendOTPEmail(email, otp);
    res.status(200).json({ success: true, message: "OTP sent to your email!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- ROUTE: VERIFY OTP ---
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  const record = otpStore[email];
  if (!record) return res.status(400).json({ success: false, message: "OTP not found. Please resend." });

  if (Date.now() > record.expires) {
    delete otpStore[email];
    return res.status(400).json({ success: false, message: "OTP expired." });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ success: false, message: "Invalid OTP code." });
  }

  // Success: Clear OTP and allow registration/login
  delete otpStore[email];
  res.status(200).json({ success: true, message: "OTP verified!" });
});

// --- ROUTE: REGISTER ---
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, studentClass } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already registered" });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name,
      email,
      password: hashedPassword,
      studentClass,
    });

    await user.save();
    res.status(201).json({ success: true, message: "Registration successful!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error during registration" });
  }
});

module.exports = router;
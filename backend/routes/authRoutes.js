const express = require("express");
const router = express.Router();
// IMPORTANT: We destructure the specific classes we need from the package
const { TransactionalEmailsApi, SendSmtpEmail, TransactionalEmailsApiApiKeys } = require("@getbrevo/brevo");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// --- BREVO INITIALIZATION ---
// 1. Create the API instance
const apiInstance = new TransactionalEmailsApi();

// 2. Configure the API Key using the dedicated constant
apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

// Temporary store for OTPs (In-memory)
const otpStore = {};

// --- HELPER: SEND OTP VIA BREVO ---
const sendOTPEmail = async (email, otp) => {
  const sendSmtpEmail = new SendSmtpEmail();

  sendSmtpEmail.subject = "PiMentor: Your Verification Code";
  sendSmtpEmail.htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #4CAF50;">Welcome to PiMentor</h2>
        <p>Your OTP for account verification is:</p>
        <h1 style="letter-spacing: 5px; color: #333;">${otp}</h1>
        <p>This code is valid for 10 minutes.</p>
        <hr/>
        <p style="font-size: 0.8rem; color: #777;">PiMentor Educational Services, Gorakhpur</p>
      </body>
    </html>`;
  
  // The sender email MUST be verified in your Brevo dashboard
  sendSmtpEmail.sender = { name: "PiMentor", email: process.env.GMAIL_USER }; 
  sendSmtpEmail.to = [{ email: email }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`[Brevo] OTP sent successfully to ${email}`);
    return true;
  } catch (error) {
    // Log the full error to catch things like "unverified sender"
    console.error("Brevo API Error:", error.response ? error.response.body : error.message);
    throw new Error("Failed to send OTP email.");
  }
};

// --- ROUTE: SEND OTP ---
router.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Email is required" });

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 };

    await sendOTPEmail(email, otp);
    res.status(200).json({ success: true, message: "OTP sent!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- ROUTE: VERIFY OTP ---
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];

  if (!record || Date.now() > record.expires) {
    return res.status(400).json({ success: false, message: "OTP expired or not found." });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ success: false, message: "Invalid OTP." });
  }

  delete otpStore[email];
  res.status(200).json({ success: true, message: "OTP verified!" });
});

// --- ROUTE: REGISTER ---
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, studentClass } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "Already registered" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ name, email, password: hashedPassword, studentClass });
    await user.save();
    res.status(201).json({ success: true, message: "Registered!" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
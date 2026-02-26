const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const axios = require("axios"); // Ensure you ran 'npm install axios'

// In-memory OTP store (10-minute expiry)
const otpStore = {};

// --- THE EXACT SOLUTION: DIRECT API CALL ---
const sendOTPEmail = async (email, otp) => {
    const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
    
    const emailData = {
        sender: { name: "PiMentor", email: process.env.GMAIL_USER }, // Verified Brevo Email
        to: [{ email: email }],
        subject: "PiMentor: Your Verification Code",
        htmlContent: `
            <html>
                <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
                    <div style="max-width: 500px; margin: auto; background: white; padding: 20px; border-radius: 10px; border: 1px solid #ddd;">
                        <h2 style="color: #4CAF50; text-align: center;">Welcome to PiMentor</h2>
                        <p>Your OTP for account verification is:</p>
                        <h1 style="text-align: center; font-size: 3rem; letter-spacing: 5px; color: #333;">${otp}</h1>
                        <p>This code is valid for 10 minutes.</p>
                        <hr>
                        <p style="font-size: 0.8rem; color: #888; text-align: center;">PiMentor Educational Services, Gorakhpur</p>
                    </div>
                </body>
            </html>`
    };

    try {
        const response = await axios.post(BREVO_API_URL, emailData, {
            headers: {
                "api-key": process.env.BREVO_API_KEY,
                "Content-Type": "application/json"
            }
        });
        console.log(`[Brevo API]: Success! MessageID: ${response.data.messageId}`);
        return true;
    } catch (error) {
        console.error("Brevo API Error:", error.response ? error.response.data : error.message);
        throw new Error("Failed to send OTP. Check Brevo API Key or Sender Email.");
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
        res.status(200).json({ success: true, message: "OTP sent successfully!" });
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
        return res.status(400).json({ success: false, message: "Invalid OTP code." });
    }

    delete otpStore[email];
    res.status(200).json({ success: true, message: "OTP verified!" });
});

// --- ROUTE: REGISTER ---
router.post("/register", async (req, res) => {
    try {
        const { name, email, password, studentClass } = req.body;
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ success: false, message: "User already registered." });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({ name, email, password: hashedPassword, studentClass });
        await user.save();
        res.status(201).json({ success: true, message: "Registration successful!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error during registration" });
    }
});

module.exports = router;
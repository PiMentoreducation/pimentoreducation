const express = require("express");
const nodemailer = require('nodemailer');
const bcrypt = require("bcryptjs");
const router = express.Router();

// Imports
const User = require("../models/User"); 
const { register, login } = require("../controllers/authController");

// ---------------------------------------------------------
// 1. Nodemailer Transporter Configuration
// ---------------------------------------------------------
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
        tls: {
        rejectUnauthorized: false // This helps bypass local certificate errors
    }
    },
});

// Helper function for sending emails
const sendOTPEmail = async (recipientEmail, otp) => {
    const mailOptions = {
        from: `"PiMentor Support" <${process.env.GMAIL_USER}>`,
        to: recipientEmail,
        subject: "Verification Code - PiMentor",
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
                <h2 style="color: #4CAF50;">PiMentor Verification</h2>
                <p>Your One-Time Password (OTP) is:</p>
                <h1 style="letter-spacing: 5px;">${otp}</h1>
                <p>This code is valid for 5 minutes. Do not share this with anyone.</p>
            </div>
        `
    };
    await transporter.sendMail(mailOptions);
};

// Temporary in-memory store for OTPs
let otpStore = {}; 

// ---------------------------------------------------------
// 2. Authentication Routes
// ---------------------------------------------------------

// ROUTE: Send OTP (Handles both Register & Forgot Password)
router.post("/send-otp", async (req, res) => {
    const { email, type } = req.body; // type should be 'register' or 'forgot'
    
    if (!email) return res.status(400).json({ message: "Email is required" });

    try {
        const userExists = await User.findOne({ email });

        // Logical Gating based on Purpose
        if (type === 'register' && userExists) {
            return res.status(400).json({ message: "Email already registered. Please login." });
        }
        
        if (type === 'forgot' && !userExists) {
            return res.status(404).json({ message: "No account found with this email." });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store with 5-minute expiry
        otpStore[email] = { 
            otp: otp, 
            expires: Date.now() + 300000 
        };

        await sendOTPEmail(email, otp);
        res.status(200).json({ message: "OTP sent successfully to " + email });

    } catch (error) {
        console.error("Email Error:", error);
        res.status(500).json({ message: "Error sending email" });
    }
});

// ROUTE: Verify OTP
router.post("/verify-otp", (req, res) => {
    const { email, otp } = req.body;
    const record = otpStore[email];

    if (!record) {
        return res.status(400).json({ message: "Please request an OTP first" });
    }

    if (record.expires < Date.now()) {
        delete otpStore[email];
        return res.status(400).json({ message: "OTP has expired" });
    }

    if (record.otp === otp) {
        delete otpStore[email]; // Clear after use
        res.status(200).json({ success: true, message: "Email verified!" });
    } else {
        res.status(400).json({ message: "Invalid OTP. Please try again." });
    }
});

// ROUTE: Final Password Reset
router.post("/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        await user.save();
        res.json({ success: true, message: "Password updated successfully!" });
    } catch (err) {
        console.error("Reset Error:", err);
        res.status(500).json({ message: "Server error during password reset" });
    }
});

// Standard Auth Routes
router.post("/register", register);
router.post("/login", login);

module.exports = router;
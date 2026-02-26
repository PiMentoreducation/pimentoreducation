const express = require("express");
const nodemailer = require('nodemailer');
const bcrypt = require("bcryptjs");
const router = express.Router();

// Imports
const User = require("../models/User"); 
const { register, login } = require("../controllers/authController");

// ---------------------------------------------------------
// 1. Nodemailer Transporter Configuration (Optimized for Render)
// ---------------------------------------------------------
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    },
    debug: true, // This will show every step of the "Handshake"
    logger: true // This will print the full conversation to Render Logs
});

// Helper function for sending emails
const sendOTPEmail = async (recipientEmail, otp) => {
    const mailOptions = {
        from: `"PiMentor Support" <${process.env.GMAIL_USER}>`,
        to: recipientEmail,
        subject: "Verification Code - PiMentor",
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4CAF50;">PiMentor Verification</h2>
                <p>Hello,</p>
                <p>Your One-Time Password (OTP) for PiMentor is:</p>
                <h1 style="letter-spacing: 5px; color: #333; background: #f4f4f4; padding: 10px; display: inline-block;">${otp}</h1>
                <p>This code is valid for 5 minutes. Do not share this with anyone.</p>
                <hr style="border: none; border-top: 1px solid #eee;" />
                <p style="font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
            </div>
        `
    };
    
    // Using a promise-based approach for cloud reliability
    return transporter.sendMail(mailOptions);
};

// Temporary in-memory store for OTPs
// Note: In production, consider using Redis if you scale beyond one server
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

        // Logical Gating
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
        res.status(500).json({ message: "Error sending email. Please try again later." });
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
        delete otpStore[email]; // Clear after successful use
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
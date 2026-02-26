const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Course = require("../models/Course");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");

// In-memory OTP store
const otpStore = {};

// --- BREVO API SEND FUNCTION ---
const sendOTPEmail = async (email, otp) => {
    const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
    const emailData = {
        sender: { name: "PiMentor", email: process.env.GMAIL_USER },
        to: [{ email: email }],
        subject: "PiMentor: Your Verification Code",
        htmlContent: `<html><body style="font-family: Arial;"><h2>PiMentor Verification</h2><p>Your code is: <strong style="font-size: 20px;">${otp}</strong></p></body></html>`
    };

    try {
        await axios.post(BREVO_API_URL, emailData, {
            headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json" }
        });
        return true;
    } catch (error) {
        console.error("Brevo Error:", error.response ? error.response.data : error.message);
        throw new Error("Email delivery failed.");
    }
};

// --- 1. SMART OTP ROUTE (WITH VALIDATION) ---
router.post("/send-otp", async (req, res) => {
    const { email, type } = req.body; // 'type' should be 'register' or 'forgot'
    
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    try {
        const userExists = await User.findOne({ email });

        // Logic Gate for Registration
        if (type === "register" && userExists) {
            return res.status(400).json({ success: false, message: "Email already registered. Please login." });
        }

        // Logic Gate for Forgot Password
        if (type === "forgot" && !userExists) {
            return res.status(400).json({ success: false, message: "No account found with this email." });
        }

        // If validation passes, generate and send OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[email] = { otp, expires: Date.now() + 10 * 60 * 1000 };
        
        await sendOTPEmail(email, otp);
        res.status(200).json({ success: true, message: "OTP sent successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// --- 2. VERIFY OTP ROUTE ---
router.post("/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    const record = otpStore[email];
    if (!record || Date.now() > record.expires) return res.status(400).json({ success: false, message: "OTP expired." });
    if (record.otp !== otp) return res.status(400).json({ success: false, message: "Invalid OTP." });
    
    delete otpStore[email];
    res.status(200).json({ success: true, message: "OTP verified!" });
});

// --- 3. REGISTER ROUTE ---
router.post("/register", async (req, res) => {
    try {
        const { name, email, password, studentClass } = req.body;
        
        // Double check even at registration
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ success: false, message: "User already exists." });

        const salt = await bcrypt.getSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({ name, email, password: hashedPassword, studentClass });
        await user.save();
        res.status(201).json({ success: true, message: "Registration successful!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error during registration." });
    }
});

// --- 4. LOGIN ROUTE ---
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ success: false, message: "Invalid Credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: "Invalid Credentials" });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.status(200).json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, studentClass: user.studentClass }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error during login" });
    }
});

// --- 5. FORGOT PASSWORD (RESET) ROUTE ---
router.post("/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        await User.findOneAndUpdate({ email }, { password: hashedPassword });
        res.status(200).json({ success: true, message: "Password updated successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error resetting password." });
    }
});

// --- 6. COURSE & LECTURE LOGIC ---
router.get("/courses", async (req, res) => {
    try {
        const courses = await Course.find();
        res.status(200).json({ success: true, courses });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error fetching courses" });
    }
});

router.get("/courses/:courseId/lectures", async (req, res) => {
    try {
        const course = await Course.findById(req.params.courseId);
        if (!course) return res.status(404).json({ success: false, message: "Course not found" });
        res.status(200).json({ success: true, lectures: course.lectures });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error fetching lectures" });
    }
});

module.exports = router;
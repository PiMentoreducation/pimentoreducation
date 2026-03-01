const express = require("express");
const router = express.Router();

// 1. IMPORT CONTROLLER FUNCTIONS
const { buyCourse, getMyCourses } = require("../controllers/purchaseController");
const authMiddleware = require("../middleware/authMiddleware");

// 2. IMPORT MODELS
const Purchase = require("../models/Purchase"); 
const Course = require("../models/Course");
const Lecture = require("../models/Lecture");
const User = require("../models/User");
const Doubt = require("../models/Doubt");

/* ================= CORE PURCHASE ROUTES ================= */

router.post("/buy", authMiddleware, buyCourse);
router.get("/my-courses", authMiddleware, getMyCourses);

/* ================= ACCESS & CONTENT ROUTES ================= */

// Verify if a student has access
router.get("/verify-access/:courseId", authMiddleware, async (req, res) => {
    try {
        const hasAccess = await Purchase.findOne({ 
            userId: req.user.id, 
            courseId: req.params.courseId 
        });
        res.status(200).json({ authorized: !!hasAccess });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Get Chapters (Filtered by Access)
router.get("/course-chapters/:courseId", authMiddleware, async (req, res) => {
    try {
        const { courseId } = req.params;
        const hasAccess = await Purchase.findOne({ userId: req.user.id, courseId });
        if (!hasAccess) return res.status(403).json({ message: "Access Denied" });

        const chapters = await Lecture.distinct("chapterName", { courseId });
        res.status(200).json(chapters);
    } catch (error) {
        res.status(500).json({ message: "Error fetching chapters" });
    }
});

// Get Lectures (Filtered by Access)
router.get("/course-content/:courseId/:chapterName", authMiddleware, async (req, res) => {
    try {
        const { courseId, chapterName } = req.params;
        const hasAccess = await Purchase.findOne({ userId: req.user.id, courseId });
        if (!hasAccess) return res.status(403).json({ message: "Access Denied" });

        const lectures = await Lecture.find({ 
            courseId, 
            chapterName: decodeURIComponent(chapterName) 
        }).sort({ order: 1 });

        res.status(200).json(lectures);
    } catch (error) {
        res.status(500).json({ message: "Error fetching topics" });
    }
});

/* ================= DOUBT SECTION ================= */

router.post("/ask-doubt", authMiddleware, async (req, res) => {
    try {
        const { lectureId, question } = req.body;
        if (!lectureId || !question) return res.status(400).json({ message: "Missing data" });

        const lecture = await Lecture.findById(lectureId);
        const user = await User.findById(req.user.id);

        const newDoubt = new Doubt({
            studentId: user._id,
            studentName: user.name,
            courseId: lecture.courseId,
            lectureId: lecture._id,
            lectureTitle: lecture.title,
            question: question
        });

        await newDoubt.save();
        res.status(201).json({ message: "Doubt submitted!" });
    } catch (error) {
        res.status(500).json({ message: "Error submitting doubt" });
    }
});

// GET doubts for dashboard
router.get("/my-dashboard-doubts", authMiddleware, async (req, res) => {
    try {
        const doubts = await Doubt.find({ studentId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(doubts);
    } catch (error) {
        res.status(500).json({ message: "Error fetching doubts" });
    }
});

module.exports = router;
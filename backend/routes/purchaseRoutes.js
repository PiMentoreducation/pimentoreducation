const express = require("express");
const router = express.Router();

// 1. Ensure these names match the 'exports.name' in your controller
const { buyCourse, getMyCourses } = require("../controllers/purchaseController");
const authMiddleware = require("../middleware/authMiddleware");

// 2. Models (Renamed to PurchaseModel to avoid conflicts)
const PurchaseModel = require("../models/Purchase"); 
const Course = require("../models/Course");
const Lecture = require("../models/Lecture");
const User = require("../models/User");
const Doubt = require("../models/Doubt");

// 3. Routes - Check if any of these variables (buyCourse, getMyCourses) are undefined
router.post("/buy", authMiddleware, buyCourse); // Line 17?
router.get("/my-courses", authMiddleware, getMyCourses);

// ... rest of your routes

// 2. Access Verification Route (Updated to use PurchaseModel)
router.get("/verify-access/:courseId", authMiddleware, async (req, res) => {
    try {
        const hasAccess = await PurchaseModel.findOne({ 
            userId: req.user.id, 
            courseId: req.params.courseId 
        });
        res.status(200).json({ authorized: !!hasAccess });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

/* ================= HIERARCHICAL CONTENT DELIVERY (STUDENT) ================= */

// A. Get Unique Chapters for a Course (Updated to use PurchaseModel)
router.get("/course-chapters/:courseId", authMiddleware, async (req, res) => {
    try {
        const { courseId } = req.params;
        const hasAccess = await PurchaseModel.findOne({ userId: req.user.id, courseId });
        if (!hasAccess) return res.status(403).json({ message: "Access Denied: Please purchase this course." });

        const chapters = await Lecture.distinct("chapterName", { courseId });
        res.status(200).json(chapters);
    } catch (error) {
        res.status(500).json({ message: "Error fetching chapters" });
    }
});

// B. Get Lectures for a Specific Chapter (Updated to use PurchaseModel)
router.get("/course-content/:courseId/:chapterName", authMiddleware, async (req, res) => {
    try {
        const { courseId, chapterName } = req.params;
        const hasAccess = await PurchaseModel.findOne({ userId: req.user.id, courseId });
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

// C. Get Single Lecture Details (Updated to use PurchaseModel)
router.get("/lecture-details/:lectureId", authMiddleware, async (req, res) => {
    try {
        const lecture = await Lecture.findById(req.params.lectureId);
        if (!lecture) return res.status(404).json({ message: "Lecture not found" });

        const hasAccess = await PurchaseModel.findOne({ userId: req.user.id, courseId: lecture.courseId });
        if (!hasAccess) return res.status(403).json({ message: "Access Denied" });

        res.json(lecture);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// ... rest of your code remains the same

/* ================= ADMIN SPECIFIC ROUTES ================= */

// D. Fetch all lectures for Admin Dropdown
router.get("/all-lectures-admin/:courseId", authMiddleware, async (req, res) => {
    try {
        const { courseId } = req.params;
        const lectures = await Lecture.find({ courseId }).sort({ order: 1 });
        res.json(lectures);
    } catch (error) {
        res.status(500).json({ message: "Error fetching lectures for admin" });
    }
});

/* ================= GENERAL DISCOVERY ================= */

router.get("/all-courses", authMiddleware, async (req, res) => {
    try {
        const courses = await Course.find().sort({ createdAt: -1 });
        res.json(courses);
    } catch (error) {
        res.status(500).json({ message: "Error fetching courses" });
    }
});

/* ================= DOUBT SECTION ================= */

router.post("/ask-doubt", authMiddleware, async (req, res) => {
    try {
        const { lectureId, question } = req.body;
        
        // Ensure inputs exist
        if (!lectureId || !question) {
            return res.status(400).json({ message: "Missing lectureId or question" });
        }

        const lecture = await Lecture.findById(lectureId);
        if (!lecture) return res.status(404).json({ message: "Lecture not found" });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const newDoubt = new Doubt({
            studentId: user._id,
            studentName: user.name,
            courseId: lecture.courseId,
            lectureId: lecture._id,
            lectureTitle: lecture.title,
            question: question
        });

        await newDoubt.save();
        res.status(201).json({ message: "Doubt submitted successfully" });
    } catch (error) {
        console.error("DOUBT ERROR:", error);
        res.status(500).json({ message: "Error submitting doubt" });
    }
});
// GET all doubts for a specific lecture (to show student their history)
router.get("/my-doubts/:lectureId", authMiddleware, async (req, res) => {
    try {
        const doubts = await Doubt.find({ 
            lectureId: req.params.lectureId, 
            studentId: req.user.id 
        }).sort({ createdAt: -1 });
        
        res.status(200).json(doubts);
    } catch (error) {
        res.status(500).json({ message: "Error fetching your doubts" });
    }
});
// GET all doubts for a student (for their Dashboard 'Inbox')
router.get("/my-dashboard-doubts", authMiddleware, async (req, res) => {
    try {
        // We find all doubts belonging to the logged-in student
        const doubts = await Doubt.find({ studentId: req.user.id })
            .sort({ createdAt: -1 }); // Newest first
        res.status(200).json(doubts);
    } catch (error) {
        console.error("DASHBOARD DOUBT FETCH ERROR:", error);
        res.status(500).json({ message: "Error fetching dashboard doubts" });
    }
});
module.exports = router;
const express = require("express");
const router = express.Router();
const Quiz = require("../models/Quiz");

// 1. IMPORT CONTROLLER FUNCTIONS
const { buyCourse, getMyCourses } = require("../controllers/purchaseController");
const authMiddleware = require("../middleware/authMiddleware");

// 2. IMPORT MODELS
const Purchase = require("../models/Purchase"); 
const Course = require("../models/Course");
const Lecture = require("../models/Lecture");
const User = require("../models/User");
const Doubt = require("../models/Doubt");
const Progress = require("../models/Progress");

// GET Leaderboard for a specific course
const Notification = require("../models/Notification"); // Standard import

/* ================= CORE PURCHASE & DASHBOARD ================= */

// The new "Direct-to-Disk" buy route
router.post("/buy", authMiddleware, buyCourse);

// Fetch student's purchased courses
router.get("/my-courses", authMiddleware, getMyCourses);

/* ================= ACCESS & CONTENT DELIVERY (RETAINED) ================= */

// Verify if student has access to a specific course
router.get("/verify-access/:courseId", authMiddleware, async (req, res) => {
    try {
        const purchase = await Purchase.findOne({
            userId: req.user.id,
            courseId: req.params.courseId
        });

        if (!purchase) {
            return res.status(403).json({ authorized: false });
        }

        if (new Date() > purchase.expiryDate) {
            return res.status(403).json({ authorized: false, message: "Course Expired" });
        }

        return res.status(200).json({ authorized: true });

    } catch (error) {
        console.error("VERIFY ACCESS ERROR:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// A. Get Unique Chapters for a Course
router.get("/course-chapters/:courseId", authMiddleware, async (req, res) => {
    try {
        const { courseId } = req.params;
        const hasAccess = await Purchase.findOne({ userId: req.user.id, courseId });
        if (!hasAccess) return res.status(403).json({ message: "Access Denied: Please purchase this course." });

        const chapters = await Lecture.distinct("chapterName", { courseId });
        res.status(200).json(chapters);
    } catch (error) {
        res.status(500).json({ message: "Error fetching chapters" });
    }
});

// B. Get Lectures for a Specific Chapter
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

// C. Get Single Lecture Details
router.get("/lecture-details/:lectureId", authMiddleware, async (req, res) => {
    try {
        const lecture = await Lecture.findById(req.params.lectureId);
        if (!lecture) return res.status(404).json({ message: "Lecture not found" });

        const hasAccess = await Purchase.findOne({ userId: req.user.id, courseId: lecture.courseId });
        if (!hasAccess) return res.status(403).json({ message: "Access Denied" });

        res.json(lecture);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

/* ================= ADMIN SPECIFIC ROUTES (RETAINED) ================= */

router.get("/all-lectures-admin/:courseId", authMiddleware, async (req, res) => {
    try {
        const { courseId } = req.params;
        const lectures = await Lecture.find({ courseId }).sort({ order: 1 });
        res.json(lectures);
    } catch (error) {
        res.status(500).json({ message: "Error fetching lectures for admin" });
    }
});

/* ================= GENERAL DISCOVERY (RETAINED) ================= */

router.get("/all-courses", authMiddleware, async (req, res) => {
    try {
        const courses = await Course.find().sort({ createdAt: -1 });
        res.json(courses);
    } catch (error) {
        res.status(500).json({ message: "Error fetching courses" });
    }
});

/* ================= DOUBT SECTION (RETAINED) ================= */

router.post("/ask-doubt", authMiddleware, async (req, res) => {
    try {
        const { lectureId, question } = req.body;
        if (!lectureId || !question) return res.status(400).json({ message: "Missing lectureId or question" });

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
        res.status(500).json({ message: "Error submitting doubt" });
    }
});

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

router.get("/my-dashboard-doubts", authMiddleware, async (req, res) => {
    try {
        const doubts = await Doubt.find({ studentId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(doubts);
    } catch (error) {
        res.status(500).json({ message: "Error fetching dashboard doubts" });
    }
});

/* ================= NOTIFICATIONS (STUDENT SAFE) ================= */

// This route is called by your dashboard fetch to show broadcasts
router.get("/active-notifications", authMiddleware, async (req, res) => {
    try {
        const list = await Notification.find().sort({ createdAt: -1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: "Error fetching notifications" });
    }
});

// Fixed the naming error here (auth -> authMiddleware)
router.get("/notifications", authMiddleware, async (req, res) => {
    try {
        const list = await Notification.find().sort({ createdAt: -1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: "Error fetching notifications" });
    }
});

router.get("/quiz/fetch/:lectureId", authMiddleware, async (req, res) => {
    try {
        const quiz = await Quiz.findOne({ lectureId: req.params.lectureId });
        if (!quiz) return res.status(404).json({ message: "No quiz found" });
        res.json(quiz);
    } catch (err) { res.status(500).json({ message: "Server error" }); }
});

router.get("/leaderboard/:courseId", authMiddleware, async (req, res) => {
    try {
        const { courseId } = req.params;

        // 1. Get total number of lectures for this course to calculate video %
        const totalLectures = await Lecture.countDocuments({ courseId });
        if (totalLectures === 0) return res.json([]);

        const stats = await Progress.aggregate([
            { $match: { courseId: courseId } },
            { $group: { 
                _id: "$studentEmail", 
                name: { $first: "$studentName" }, 
                videosCompleted: { $sum: { $cond: ["$isVideoCompleted", 1, 0] } },
                totalQuizScore: { $sum: "$highestQuizScore" },
                quizzesTaken: { $sum: { $cond: [{ $gt: ["$highestQuizScore", -1] }, 1, 0] } } 
                // Assumes -1 or null if quiz not taken
            }},
            { $project: {
                name: 1,
                videoProgress: { $multiply: [{ $divide: ["$videosCompleted", totalLectures] }, 100] },
                quizProgress: { 
                    $cond: [
                        { $gt: ["$quizzesTaken", 0] },
                        { $multiply: [{ $divide: ["$totalQuizScore", { $multiply: ["$quizzesTaken", 10] }] }, 100] }, 
                        0 
                    ]
                } // Assumes each quiz is out of 10. Adjust if different.
            }},
            { $addFields: {
                finalScore: { $divide: [{ $add: ["$videoProgress", "$quizProgress"] }, 2] }
            }},
            { $sort: { finalScore: -1 } },
            { $limit: 10 }
        ]);

        const leaderboard = stats.map(s => ({
            name: s.name,
            score: s.finalScore.toFixed(1) // Rounded to 1 decimal
        }));

        res.json(leaderboard);
    } catch (err) {
        console.error("Leaderboard Error:", err);
        res.status(500).json({ message: "Leaderboard error" });
    }
});
module.exports = router;
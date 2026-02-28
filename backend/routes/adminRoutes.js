const express = require("express");
const router = express.Router(); 

// Models
const User = require("../models/User");
const Course = require("../models/Course");
const Purchase = require("../models/Purchase");
const Lecture = require("../models/Lecture"); 
const Doubt = require("../models/Doubt");
const Notification = require("../models/Notification");

// Middlewares
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/admin");

/* ================= COURSE MANAGEMENT ================= */

router.get("/all-courses", auth, admin, async (req, res) => {
  try {
    const courses = await Course.find({}, "courseId title");
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: "Error fetching courses" });
  }
});

router.post("/course", auth, admin, async (req, res) => {
  try {
    const { courseId, title, className, price, description, notesLink } = req.body;
    if (!courseId || !title || !className || !price) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const exists = await Course.findOne({ courseId });
    if (exists) return res.status(400).json({ message: "Course ID already exists." });

    const course = await Course.create({ courseId, title, className, price, description, notesLink });
    res.status(201).json({ message: "Course created successfully!", course });
  } catch (error) {
    res.status(500).json({ message: "Server error while creating course" });
  }
});

router.delete("/course/:courseId", auth, admin, async (req, res) => {
    try {
        const { courseId } = req.params;
        await Course.findOneAndDelete({ courseId });
        await Lecture.deleteMany({ courseId });
        res.json({ message: "Course and all associated lectures wiped." });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete course" });
    }
});

/* ================= LECTURE MANAGEMENT ================= */

router.post("/course/:courseId/lecture", auth, admin, async (req, res) => {
  try {
    const { courseId } = req.params; 
    const { lectureTitle, videoUrl, duration, pdfNotes, practiceMcq, chapterName, topicName, order } = req.body; 

    const newLecture = new Lecture({
        courseId,
        title: lectureTitle,
        videoUrl,
        duration: duration || "0:00",
        pdfNotes: pdfNotes || "",
        practiceMcq: practiceMcq || "",
        chapterName,
        topicName,
        order: parseInt(order) || 0
    });

    await newLecture.save();
    res.status(201).json({ success: true, message: `Lecture added to ${chapterName}!` });
  } catch (error) {
    res.status(500).json({ message: "Error saving lecture" });
  }
});

router.delete("/course/:courseId/lecture/:lectureId", auth, admin, async (req, res) => {
    try {
        await Lecture.findByIdAndDelete(req.params.lectureId);
        res.status(200).json({ message: "Lecture removed successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting lecture" });
    }
});

/* ================= DOUBT RESOLUTION ================= */

router.get("/doubts/:courseId", auth, admin, async (req, res) => {
    try {
        const { courseId } = req.params;
        const doubts = await Doubt.find({ courseId, status: "Pending" }).sort({ createdAt: -1 });
        res.status(200).json(doubts);
    } catch (error) {
        res.status(500).json({ message: "Error fetching doubts" });
    }
});

router.post("/resolve-doubt", auth, admin, async (req, res) => {
    try {
        const { doubtId, answer } = req.body;
        await Doubt.findByIdAndUpdate(doubtId, { answer, status: "Resolved" });
        res.status(200).json({ message: "Doubt resolved!" });
    } catch (error) {
        res.status(500).json({ message: "Error resolving doubt" });
    }
});

/* ================= NOTIFICATION PUSH ================= */

// Matches: POST /api/admin/send-notification
router.post("/send-notification", auth, admin, async (req, res) => {
    try {
        const { heading, description, link, targetCourses } = req.body;
        if(!heading || !description) return res.status(400).json({ message: "Heading and Description required" });

        const newNotif = new Notification({ heading, description, link, targetCourses });
        await newNotif.save();
        res.status(201).json({ success: true, message: "Broadcast Sent!" });
    } catch (err) {
        console.error("Broadcast Error:", err);
        res.status(500).json({ message: "Failed to broadcast." });
    }
});

router.get("/active-notifications", auth, admin, async (req, res) => {
    try {
        const list = await Notification.find().sort({ createdAt: -1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: "Error fetching list" });
    }
});

router.delete("/notification/:id", auth, admin, async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ message: "Notification removed!" });
    } catch (err) {
        res.status(500).json({ message: "Delete failed" });
    }
});

/* ================= STUDENT ENROLLMENTS ================= */

// Matches: GET /api/admin/course-enrollments/:courseId
router.get("/course-enrollments/:courseId", auth, admin, async (req, res) => {
    try {
        const { courseId } = req.params;
        
        // 1. Find purchases for THIS specific course
        const purchases = await Purchase.find({ courseId }).select("userId createdAt");
        
        if (!purchases || purchases.length === 0) {
            return res.json([]);
        }

        // 2. Map User Details
        const enrolledList = await Promise.all(purchases.map(async (p) => {
            const student = await User.findById(p.userId).select("name email studentClass");
            if(student) {
                return {
                    name: student.name,
                    email: student.email,
                    studentClass: student.studentClass,
                    enrolledAt: p.createdAt
                };
            }
            return null;
        }));

        // 3. Filter out any nulls (if a user was deleted but purchase remains)
        res.json(enrolledList.filter(item => item !== null));

    } catch (err) {
        console.error("Enrollment Error:", err);
        res.status(500).json({ message: "Error fetching enrollments" });
    }
});

module.exports = router;
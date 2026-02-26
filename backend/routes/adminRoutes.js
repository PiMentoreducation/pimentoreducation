const express = require("express");
const router = express.Router(); 

// Models - ALL MUST MATCH FILE CASE EXACTLY
const User = require("../models/User");
const Course = require("../models/Course");
const Purchase = require("../models/Purchase");
const Lecture = require("../models/Lecture"); 
const Doubt = require("../models/Doubt"); // Ensure this 'D' matches models/Doubt.js

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
    if (exists) return res.status(400).json({ message: "Course ID exists." });

    const course = await Course.create({ courseId, title, className, price, description, notesLink });
    res.status(201).json({ message: "Course created!", course });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
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
    res.status(201).json({ success: true, message: `Added to ${chapterName}!` });
  } catch (error) {
    res.status(500).json({ message: "Save Error" });
  }
});

router.delete("/course/:courseId/lecture/:lectureId", auth, admin, async (req, res) => {
    try {
        await Lecture.findByIdAndDelete(req.params.lectureId);
        res.status(200).json({ message: "Lecture removed!" });
    } catch (error) {
        res.status(500).json({ message: "Error" });
    }
});

/* ================= DOUBT RESOLUTION CENTER ================= */

// GET pending doubts for a course
router.get("/doubts/:courseId", auth, admin, async (req, res) => {
    try {
        const { courseId } = req.params;
        const doubts = await Doubt.find({ courseId, status: "Pending" }).sort({ createdAt: -1 });
        res.status(200).json(doubts);
    } catch (error) {
        res.status(500).json({ message: "Error fetching doubts" });
    }
});

// POST resolution for a doubt
router.post("/resolve-doubt", auth, admin, async (req, res) => {
    try {
        const { doubtId, answer } = req.body;
        const updatedDoubt = await Doubt.findByIdAndUpdate(
            doubtId,
            { answer, status: "Resolved" },
            { new: true }
        );
        if (!updatedDoubt) return res.status(404).json({ message: "Doubt not found" });
        res.status(200).json({ message: "Doubt resolved!" });
    } catch (error) {
        res.status(500).json({ message: "Error resolving doubt" });
    }
});
// DELETE all doubts that are already Resolved
router.delete("/clear-resolved-doubts", auth, admin, async (req, res) => {
    try {
        const result = await Doubt.deleteMany({ status: "Resolved" });
        res.json({ message: `${result.deletedCount} resolved doubts cleared from storage.` });
    } catch (error) {
        res.status(500).json({ message: "Cleanup failed" });
    }
});

module.exports = router;
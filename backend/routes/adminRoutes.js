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

// Fetch all courses for admin dropdowns/lists
router.get("/all-courses", auth, admin, async (req, res) => {
  try {
    const courses = await Course.find({}, "courseId title liveValidityDate recordedDurationDays price");
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: "Error fetching courses" });
  }
});

// Create or Update Course (Upsert)
router.post("/course", auth, admin, async (req, res) => {
    try {
        const { courseId, title, className, price, description, liveValidityDate, recordedDurationDays } = req.body;
        
        const course = await Course.findOneAndUpdate(
            { courseId },
            { 
                title, 
                className, 
                price, 
                description, 
                // Ensure date is properly formatted
                liveValidityDate: liveValidityDate ? new Date(liveValidityDate) : null, 
                recordedDurationDays: parseInt(recordedDurationDays) || 365 
            },
            { new: true, upsert: true }
        );
        res.status(201).json({ message: "Course settings updated!", course });
    } catch (error) {
        res.status(500).json({ message: "Error updating course" });
    }
});

// Delete Course and its Lectures
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

// Add Lecture to a Course
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

// Delete specific Lecture
router.delete("/course/:courseId/lecture/:lectureId", auth, admin, async (req, res) => {
    try {
        await Lecture.findByIdAndDelete(req.params.lectureId);
        res.status(200).json({ message: "Lecture removed successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting lecture" });
    }
});

/* ================= DOUBT RESOLUTION ================= */

// Get pending doubts for a specific course
router.get("/doubts/:courseId", auth, admin, async (req, res) => {
    try {
        const { courseId } = req.params;
        const doubts = await Doubt.find({ courseId, status: "Pending" }).sort({ createdAt: -1 });
        res.status(200).json(doubts);
    } catch (error) {
        res.status(500).json({ message: "Error fetching doubts" });
    }
});

// Provide answer to a student doubt
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

router.post("/send-notification", auth, admin, async (req, res) => {
    try {
        const { heading, description, link, targetCourses } = req.body;
        
        if (!heading || !description) {
            return res.status(400).json({ message: "Heading and description are required." });
        }

        const newNotif = new Notification({
            heading,
            description,
            link: link || "",
            targetCourses: targetCourses || []
        });

        await newNotif.save();
        res.status(201).json({ success: true, message: "Broadcast Sent!" });
    } catch (err) {
        res.status(500).json({ message: "Server error during broadcast." });
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

/* ================= STUDENT ENROLLMENTS & ANALYTICS ================= */

router.get("/course-enrollments/:courseId", auth, admin, async (req, res) => {
    try {
        const { courseId } = req.params;
        const purchases = await Purchase.find({ courseId }).select("userId createdAt expiryDate");
        
        if (!purchases || purchases.length === 0) return res.json([]);

        const enrolledList = await Promise.all(purchases.map(async (p) => {
            const student = await User.findById(p.userId).select("name email studentClass");
            if(student) {
                return {
                    name: student.name,
                    email: student.email,
                    studentClass: student.studentClass,
                    enrolledAt: p.createdAt,
                    expiryDate: p.expiryDate
                };
            }
            return null;
        }));

        res.json(enrolledList.filter(item => item !== null));
    } catch (err) {
        res.status(500).json({ message: "Error fetching enrollments" });
    }
});

/* ================= DATABASE MAINTENANCE (THE SYNC) ================= */

/**
 * THE MASTER SYNC: This applies your Piecewise Expiry Rule to all purchases.
 * Use this to fix any records missing 'expiryDate' or 'purgeAt'.
 */
// backend/routes/adminRoutes.js

/**
 * MASTER SYNC ROUTE
 * Purpose: Fixes all old purchases that are missing expiryDate/purgeAt fields.
 */
// backend/routes/adminRoutes.js

router.get("/force-sync-expiries", auth, admin, async (req, res) => {
    try {
        const purchases = await Purchase.find({ expiryDate: { $exists: false } });
        let count = 0;

        for (let p of purchases) {
            const course = await Course.findOne({ courseId: p.courseId });
            if (course) {
                const enrollTime = new Date(p.createdAt).getTime();
                const liveLimitTime = course.liveValidityDate ? new Date(course.liveValidityDate).getTime() : null;

                let expiry;
                if (liveLimitTime && enrollTime <= liveLimitTime) {
                    expiry = new Date(liveLimitTime);
                } else {
                    expiry = new Date(enrollTime);
                    expiry.setDate(expiry.getDate() + (course.recordedDurationDays || 365));
                }

                const purge = new Date(expiry);
                purge.setDate(purge.getDate() + 10);

                // DIRECT UPDATE BYPASS
                await Purchase.collection.updateOne(
                    { _id: p._id },
                    { $set: { expiryDate: expiry, purgeAt: purge } }
                );
                count++;
            }
        }
        res.json({ success: true, message: `Forced sync on ${count} records.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
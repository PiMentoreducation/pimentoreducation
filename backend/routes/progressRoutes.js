const express = require("express");
const router = express.Router();
const Progress = require("../models/Progress");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const authMiddleware = require('../middleware/authMiddleware'); 
const { generateMonthlyPDF } = require('../utils/pdfService');
router.post("/update-progress", auth, async (req, res) => {
    try {
        const { courseId, lectureId, isVideoCompleted } = req.body;
        const user = await User.findById(req.user.id);

        const filter = { studentEmail: user.email, lectureId: lectureId };
        const update = {
            studentName: user.name,
            courseId: courseId,
            isVideoCompleted: isVideoCompleted,
            lastUpdated: Date.now()
        };

        // Find progress for this specific lecture or create new
        const progress = await Progress.findOneAndUpdate(filter, update, { upsert: true, new: true });

        // Mastery Check
        if (progress.isVideoCompleted && progress.isQuizAttempted) {
            progress.isMastered = true;
            await progress.save();
        }

        res.json({ success: true, isMastered: progress.isMastered });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

// Record Quiz Score
router.post("/submit-quiz", auth, async (req, res) => {
    try {
        const { courseId, lectureId, score } = req.body;
        const user = await User.findById(req.user.id);

        const filter = { studentEmail: user.email, lectureId: lectureId };
        const update = {
            studentName: user.name,
            courseId: courseId,
            isQuizAttempted: true,
            highestQuizScore: score,
            lastUpdated: Date.now()
        };

        const progress = await Progress.findOneAndUpdate(filter, update, { upsert: true, new: true });

        // Mastery Check
        if (progress.isVideoCompleted && progress.isQuizAttempted) {
            progress.isMastered = true;
            await progress.save();
        }

        res.json({ success: true, message: "Quiz Recorded" });
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});
// Add this to routes/progressRoutes.js

// Fetch detailed progress for a specific course (used by Dashboard Mini-Window)
router.get("/course-details/:courseId", auth, async (req, res) => {
    try {
        const userId = req.user.id; // Get the logged-in student's ID
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Find all progress documents matching this student's email and the specific course
        const detailedProgress = await Progress.find({ 
            studentEmail: user.email, 
            courseId: req.params.courseId 
        });

        res.json(detailedProgress);
    } catch (err) {
        console.error("DASHBOARD FETCH ERROR:", err);
        res.status(500).json({ message: "Server error fetching detailed metrics" });
    }
});
router.get("/download-report/:courseId", authMiddleware, async (req, res) => {
    try {
        const courseId = decodeURIComponent(req.params.courseId);
        const studentEmail = req.user.email;

        // 1. Fetch Course, Lectures, and Student Progress
        const [course, lectures, progressRecords] = await Promise.all([
            Course.findOne({ courseId }),
            Lecture.find({ courseId }).sort({ order: 1 }),
            Progress.find({ courseId, studentEmail })
        ]);

        if (!course || lectures.length === 0) {
            return res.status(404).json({ message: "Course or lectures not found" });
        }

        // 2. Map data exactly like 'View Progress'
        let videosCompletedCount = 0;
        let totalQuizScore = 0;
        let quizzesTakenCount = 0;

        const reportData = lectures.map(lec => {
            const p = progressRecords.find(prog => prog.lectureId.toString() === lec._id.toString());
            
            const isWatched = p ? p.isVideoCompleted : false;
            const score = p ? (p.highestQuizScore || 0) : 0;

            if (isWatched) videosCompletedCount++;
            if (p && p.highestQuizScore !== undefined && p.highestQuizScore !== -1) {
                totalQuizScore += p.highestQuizScore;
                quizzesTakenCount++;
            }

            return {
                title: lec.lectureTitle,
                isVideoCompleted: isWatched,
                highestQuizScore: p && p.highestQuizScore !== -1 ? p.highestQuizScore : -1
            };
        });

        // 3. Apply your Official Formula
        const videoPerc = (videosCompletedCount / lectures.length) * 100;
        const quizPerc = quizzesTakenCount > 0 ? (totalQuizScore / (quizzesTakenCount * 10)) * 100 : 0;
        const finalScore = ((videoPerc + quizPerc) / 2).toFixed(1);

        // 4. Stream to PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=PiMentor_Report_${courseId}.pdf`);

        generateMonthlyPDF(
            { name: req.user.name },
            course.title,
            reportData,
            finalScore,
            res
        );

    } catch (err) {
        console.error("Report Generation Error:", err);
        res.status(500).send("Internal Server Error");
    }
});
const Lecture = require("../models/Lecture"); // Ensure this model is imported

// Admin: Fetch detailed student progress with multi-level filtering
router.get("/admin/student-progress", auth, async (req, res) => {
    try {
        const { courseId, studentEmail, chapterName, lectureId } = req.query;

        if (!courseId || !studentEmail) {
            return res.status(400).json({ message: "Course ID and Student Email are required" });
        }

        // 1. Get all actual lectures for this course to establish a baseline
        let lectureQuery = { courseId: courseId };
        if (chapterName && chapterName !== "") lectureQuery.chapterName = chapterName;
        if (lectureId && lectureId !== "") lectureQuery._id = lectureId;

        const lectures = await Lecture.find(lectureQuery).sort({ order: 1 });

        // 2. Get the student's progress records
        const progressRecords = await Progress.find({ 
            courseId: courseId, 
            studentEmail: studentEmail 
        });

        // 3. Map lectures to progress (to show 'Not Seen' for missing records)
        const detailedReport = lectures.map(lec => {
            const p = progressRecords.find(prog => prog.lectureId === lec._id.toString());
            
            return {
                chapterName: lec.chapterName,
                topicName: lec.topicName,
                lectureTitle: lec.lectureTitle,
                lectureId: lec._id,
                isVideoCompleted: p ? p.isVideoCompleted : false,
                isQuizAttempted: p ? p.isQuizAttempted : false,
                score: p ? p.highestQuizScore : 0,
                isMastered: p ? p.isMastered : false
            };
        });

        res.json(detailedReport);
    } catch (err) {
        console.error("Admin Progress Fetch Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
module.exports = router;
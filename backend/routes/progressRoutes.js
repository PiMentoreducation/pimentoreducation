const express = require("express");
const router = express.Router();
const Progress = require("../models/Progress");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");

// Record Video Completion (85% Rule)
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
// Add this to your progress routes
router.get("/download-report/:courseId", authMiddleware, async (req, res) => {
    try {
        const { courseId } = req.params;
        const studentEmail = req.user.email;
        const studentName = req.user.name;

        // 1. Fetch Lectures and Progress
        const lectures = await Lecture.find({ courseId }).sort({ order: 1 });
        const progress = await Progress.find({ courseId, studentEmail });
        const course = await Course.findOne({ courseId });

        if (!course) return res.status(404).json({ message: "Course not found" });

        // 2. Prepare Data for PDF
        const reportData = lectures.map(lec => {
            const prog = progress.find(p => p.lectureId.toString() === lec._id.toString());
            return {
                title: lec.lectureTitle,
                isVideoCompleted: prog ? prog.isVideoCompleted : false,
                highestQuizScore: prog ? (prog.highestQuizScore || 0) : 0
            };
        });

        // 3. Apply your Galactic Formula
        const videosWatched = reportData.filter(r => r.isVideoCompleted).length;
        const videoPerc = (videosWatched / lectures.length) * 100;
        
        const quizzesTaken = reportData.filter(r => r.highestQuizScore > 0).length;
        const totalQuizMarks = reportData.reduce((acc, curr) => acc + (curr.highestQuizScore > 0 ? curr.highestQuizScore : 0), 0);
        const quizPerc = quizzesTaken > 0 ? (totalQuizMarks / (quizzesTaken * 10)) * 100 : 0;
        
        const finalScore = ((videoPerc + quizPerc) / 2).toFixed(1);

        // 4. Set Headers for PDF Download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=PiMentor_Report_${courseId}.pdf`);

        // 5. Generate and Stream
        // Using the generateMonthlyPDF function we created earlier
        const doc = await generateMonthlyPDF(
            { name: studentName }, 
            course.title, 
            reportData, 
            finalScore,
            res // Pass the response object to stream directly
        );

    } catch (err) {
        console.error(err);
        res.status(500).send("Error generating report");
    }
});
module.exports = router;
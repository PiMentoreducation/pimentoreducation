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

module.exports = router;
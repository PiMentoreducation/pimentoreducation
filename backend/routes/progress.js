router.post('/submit-quiz', authenticateToken, async (req, res) => {
    const { courseId, lectureId, score } = req.body;
    const studentEmail = req.user.email;

    try {
        const progress = await Progress.findOneAndUpdate(
            { studentEmail, courseId, lectureId },
            { 
                isQuizAttempted: true,
                $max: { highestQuizScore: score },
                lastUpdated: Date.now()
            },
            { new: true, upsert: true }
        );

        // 🔥 Flip the Mastery switch if both criteria are now met
        if (progress.isVideoCompleted && progress.isQuizAttempted) {
            progress.isMastered = true;
            await progress.save();
        }

        res.json({ 
            success: true, 
            isMastered: progress.isMastered, 
            score: progress.highestQuizScore 
        });
    } catch (err) {
        res.status(500).json({ message: "Quiz submission failed" });
    }
});
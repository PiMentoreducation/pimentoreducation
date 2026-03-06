const mongoose = require('mongoose');

const ProgressSchema = new mongoose.Schema({
    studentEmail: { type: String, required: true, index: true },
    studentName: { type: String, required: true }, // Cached for Leaderboard speed
    courseId: { type: String, required: true, index: true },
    lectureId: { type: String, required: true },
    
    // The 85% Rule Flag
    isVideoCompleted: { type: Boolean, default: false },
    
    // The MCQ Data
    isQuizAttempted: { type: Boolean, default: false },
    highestQuizScore: { type: Number, default: 0 },
    
    // Mastery Logic: (isVideoCompleted && isQuizAttempted)
    isMastered: { type: Boolean, default: false },
    
    lastUpdated: { type: Date, default: Date.now }
});

// Composite Index for lightning-fast lookups
ProgressSchema.index({ studentEmail: 1, lectureId: 1 }, { unique: true });

module.exports = mongoose.model('Progress', ProgressSchema);
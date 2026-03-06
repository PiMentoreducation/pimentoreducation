const mongoose = require('mongoose');

const QuizSchema = new mongoose.Schema({
    courseId: { type: String, required: true, index: true },
    lectureId: { type: String, required: true, unique: true }, // One quiz per lecture
    questions: [
        {
            questionText: { type: String, required: true },
            options: [{ type: String, required: true }], // Array of 4 strings
            correctAnswerIndex: { type: Number, required: true } // 0, 1, 2, or 3
        }
    ],
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quiz', QuizSchema);
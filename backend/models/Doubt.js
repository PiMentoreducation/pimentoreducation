const mongoose = require("mongoose");

const doubtSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    studentName: { type: String, required: true },
    courseId: { type: String, required: true },
    lectureId: { type: mongoose.Schema.Types.ObjectId, ref: "Lecture", required: true },
    lectureTitle: { type: String },
    question: { type: String, required: true, maxlength: 500 },
    answer: { type: String, default: "", maxlength: 1000 },
    status: { type: String, enum: ["Pending", "Resolved"], default: "Pending" },
    createdAt: { 
        type: Date, 
        default: Date.now,
        index: { expires: '30d' } // ✅ Automatically deletes after 30 days
    }
});

module.exports = mongoose.model("Doubt", doubtSchema);
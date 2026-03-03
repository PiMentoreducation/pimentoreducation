// backend/models/Course.js
const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  courseId: { type: String, required: true, unique: true, trim: true },
  title: String,
  className: String,
  price: Number,
  oldPrice: Number, // 🔥 Added
  description: String,
  course_roadmap: String,
  thumbnail: String, // 🔥 Added
  demo1: String, // 🔥 Added
  demo2: String, // 🔥 Added
  learningPoints: String, // 🔥 Added (Stored as comma-separated string)
  teacherName: String, // 🔥 Added
  teacherImg: String, // 🔥 Added
  teacherQual: String, // 🔥 Added
  teacherAchievements: String, // 🔥 Added
  liveValidityDate: { type: Date }, 
  recordedDurationDays: { type: Number, default: 365 },
  lectures: [
    {
      lectureTitle: String,
      videoUrl: String,
      duration: String,
      pdfNotes: { type: String, default: "" },
      practiceMcq: { type: String, default: "" },
    }
  ],
}, { timestamps: true });

module.exports = mongoose.model("Course", courseSchema);
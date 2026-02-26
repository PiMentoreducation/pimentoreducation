const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  courseId: { type: String, required: true, unique: true },
  title: String,
  className: String,
  price: Number,
  description: String,
  notesLink: String,
  // We embed the lecture data directly here
  lectures: [
    {
      lectureTitle: String,
      videoUrl: String, // Each lecture gets its own video URL
      duration: String,  // Optional: e.g., "15:30"
      pdfNotes: { type: String, default: "" },   // New: Individual Lecture PDF
      practiceMcq: { type: String, default: "" }, // New: Individual Lecture Quiz
    }
  ],
});

module.exports = mongoose.model("Course", courseSchema);
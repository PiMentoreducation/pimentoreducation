const mongoose = require("mongoose");

const lectureSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  videoUrl: {
    type: String,
    required: true
  },
  duration: {
    type: String, // e.g., "15:30"
    default: "0:00"
  },
  // CHANGE: Type set to String to match your Course model's courseId (e.g., "math_101")
  courseId: {
    type: String, 
    required: true
  },
  // Hierarchical Organization
  chapterName: {
    type: String,
    required: true, // e.g., "Calculus"
    trim: true
  },
  topicName: {
    type: String,
    required: true, // e.g., "Differentiation"
    trim: true
  },
  // Logical Sequence
  order: {
    type: Number,
    default: 0 
  },
  // Resource Links
  pdfNotes: {
    type: String,
    default: ""
  },
  practiceMcq: {
    type: String,
    default: ""
  },
  locked: {
    type: Boolean,
    default: true 
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexing for faster searching by course and chapter
lectureSchema.index({ courseId: 1, chapterName: 1 });

module.exports = mongoose.model("Lecture", lectureSchema);
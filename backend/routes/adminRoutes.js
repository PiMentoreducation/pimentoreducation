const express = require("express");
const router = express.Router(); 
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Models
const User = require("../models/User");
const Course = require("../models/Course");
const Purchase = require("../models/Purchase");
const Lecture = require("../models/Lecture"); 
const Doubt = require("../models/Doubt");
const Notification = require("../models/Notification");
const Quiz = require("../models/Quiz"); // 🔥 Correctly imported Quiz model

// Middlewares
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/admin");

/* ================= COURSE MANAGEMENT ================= */

// Fetch all courses for admin dropdowns/lists
router.get("/all-courses", auth, admin, async (req, res) => {
  try {
    const courses = await Course.find({}, "courseId title liveValidityDate recordedDurationDays price");
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: "Error fetching courses" });
  }
});

// Create or Update Course (Upsert)
router.post("/course", auth, admin, async (req, res) => {
    try {
        const { 
            courseId, title, className, price, oldPrice, 
            description, course_roadmap, thumbnail, demo1, demo2, learningPoints, 
            teachers, 
            liveValidityDate, recordedDurationDays 
        } = req.body;
        
        const updateData = {
            title,
            className,
            price: Number(price),
            oldPrice: Number(oldPrice),
            description,
            course_roadmap,
            thumbnail,
            demo1,
            demo2,
            learningPoints,
            teachers,
            liveValidityDate: liveValidityDate ? new Date(liveValidityDate) : null,
            recordedDurationDays: parseInt(recordedDurationDays) || 365
        };

        const course = await Course.findOneAndUpdate(
            { courseId: courseId.trim() },
            { $set: updateData },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(201).json({ message: "Course Galaxy Synchronized!", course });
    } catch (error) {
        console.error("UPSERT ERROR:", error);
        res.status(500).json({ message: "Error updating detailed course metrics" });
    }
});

// Delete Course and its Lectures
router.delete("/course/:courseId", auth, admin, async (req, res) => {
    try {
        const { courseId } = req.params;
        await Course.findOneAndDelete({ courseId });
        await Lecture.deleteMany({ courseId });
        res.json({ message: "Course and all associated lectures wiped." });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete course" });
    }
});

/* ================= LECTURE MANAGEMENT ================= */

// Add Lecture to a Course
router.post("/course/:courseId/lecture", auth, admin, async (req, res) => {
  try {
    const { courseId } = req.params; 
    const { lectureTitle, videoUrl, duration, pdfNotes, practiceMcq, chapterName, topicName, order } = req.body; 

    const newLecture = new Lecture({
        courseId,
        title: lectureTitle,
        videoUrl,
        duration: duration || "0:00",
        pdfNotes: pdfNotes || "",
        practiceMcq: practiceMcq || "",
        chapterName,
        topicName,
        order: parseInt(order) || 0
    });

    await newLecture.save();
    res.status(201).json({ success: true, message: `Lecture added to ${chapterName}!` });
  } catch (error) {
    res.status(500).json({ message: "Error saving lecture" });
  }
});

// Delete specific Lecture
router.delete("/course/:courseId/lecture/:lectureId", auth, admin, async (req, res) => {
    try {
        await Lecture.findByIdAndDelete(req.params.lectureId);
        res.status(200).json({ message: "Lecture removed successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting lecture" });
    }
});

/* ================= AI QUIZ PIPELINE (NEW) ================= */

// Route 1: Generate questions using Gemini
router.post('/generate-quiz', auth, admin, async (req, res) => {
    const { lectureId, courseId, transcript } = req.body;
    
    if(!transcript || transcript.length < 50) {
        return res.status(400).json({ message: "Context too short to generate quality questions." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using Flash for speed

    const prompt = `
        Analyze this lecture content: "${transcript}"
        Generate exactly 5 high-quality Multiple Choice Questions.
        Return ONLY a JSON array in this exact format:
        [{"questionText": "Question string", "options": ["A", "B", "C", "D"], "correctAnswerIndex": 0}]
        Strict rules: 
        - No markdown, no backticks, no introductory text.
        - correctAnswerIndex must be a number from 0 to 3.
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        // Surgical cleaning to find the array even if AI adds extra text
        const jsonMatch = text.match(/\[.*\]/s);
        if (!jsonMatch) throw new Error("AI failed to provide a valid JSON array.");
        
        const quizData = JSON.parse(jsonMatch[0]);
        res.json({ lectureId, courseId, quiz: quizData });
    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ message: "AI generation failed. Please try again." });
    }
});

// Route 2: Commit quiz to Database
router.post('/save-quiz', auth, admin, async (req, res) => {
    const { courseId, lectureId, questions } = req.body;
    
    if(!lectureId || !questions) return res.status(400).json({ message: "Missing required quiz data." });

    try {
        await Quiz.findOneAndUpdate(
            { lectureId },
            { courseId, lectureId, questions, updatedAt: Date.now() },
            { upsert: true, new: true }
        );
        res.json({ success: true, message: "Quiz deployed to cloud! 🚀" });
    } catch (err) { 
        console.error("DB Save Error:", err);
        res.status(500).json({ message: "Database save failed" }); 
    }
});

/* ================= DOUBT RESOLUTION & ANALYTICS (RETAINED) ================= */

router.get("/doubts/:courseId", auth, admin, async (req, res) => {
    try {
        const { courseId } = req.params;
        const doubts = await Doubt.find({ courseId, status: "Pending" }).sort({ createdAt: -1 });
        res.status(200).json(doubts);
    } catch (error) {
        res.status(500).json({ message: "Error fetching doubts" });
    }
});

router.post("/resolve-doubt", auth, admin, async (req, res) => {
    try {
        const { doubtId, answer } = req.body;
        await Doubt.findByIdAndUpdate(doubtId, { answer, status: "Resolved" });
        res.status(200).json({ message: "Doubt resolved!" });
    } catch (error) {
        res.status(500).json({ message: "Error resolving doubt" });
    }
});

router.get("/course-enrollments/:courseId", auth, admin, async (req, res) => {
    try {
        const { courseId } = req.params;
        const purchases = await Purchase.find({ courseId }).select("userId createdAt expiryDate");
        
        if (!purchases || purchases.length === 0) return res.json([]);

        const enrolledList = await Promise.all(purchases.map(async (p) => {
            const student = await User.findById(p.userId).select("name email studentClass");
            if(student) {
                return {
                    name: student.name,
                    email: student.email,
                    studentClass: student.studentClass,
                    enrolledAt: p.createdAt,
                    expiryDate: p.expiryDate
                };
            }
            return null;
        }));

        res.json(enrolledList.filter(item => item !== null));
    } catch (err) {
        res.status(500).json({ message: "Error fetching enrollments" });
    }
});

/* ================= NOTIFICATION PUSH ================= */

router.post("/send-notification", auth, admin, async (req, res) => {
    try {
        const { heading, description, link, targetCourses } = req.body;
        const newNotif = new Notification({ heading, description, link: link || "", targetCourses: targetCourses || [] });
        await newNotif.save();
        res.status(201).json({ success: true, message: "Broadcast Sent!" });
    } catch (err) {
        res.status(500).json({ message: "Server error during broadcast." });
    }
});

router.get("/active-notifications", auth, admin, async (req, res) => {
    try {
        const list = await Notification.find().sort({ createdAt: -1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: "Error fetching list" });
    }
});

router.delete("/notification/:id", auth, admin, async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ message: "Notification removed!" });
    } catch (err) {
        res.status(500).json({ message: "Delete failed" });
    }
});
// NEW: Fetch single course details by courseId for the Admin Panel
// adminRoutes.js
router.get("/all-courses", auth, admin, async (req, res) => {
  try {
    // REMOVE the restricted fields list so we get full course data for the dropdowns
    const courses = await Course.find({}).sort({ createdAt: -1 });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: "Error fetching courses" });
  }
});
module.exports = router;
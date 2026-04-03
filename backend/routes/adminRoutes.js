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
const Quiz = require("../models/Quiz");
const Progress = require("../models/Progress"); // 🔥 Added Progress model import

// Middlewares
const auth = require("../middleware/authMiddleware");
const adminMiddleware = require('../middleware/admin');
const admin = require("../middleware/admin");
const { generateMonthlyPDF } = require('../utils/pdfService');

/* ================= STUDENT PROGRESS COMMAND CENTER (NEW) ================= */

// @route   GET /api/admin/student-progress
// @desc    Fetch detailed student progress with multi-level filtering
router.get("/student-progress", auth, admin, async (req, res) => {
    try {
        const { courseId, studentEmail, chapterName, lectureId } = req.query;

        if (!courseId || !studentEmail) {
            return res.status(400).json({ message: "Course ID and Student Email are required" });
        }

        // 1. Define Lecture Query based on filters
        let lectureQuery = { courseId: courseId };
        if (chapterName && chapterName !== "") lectureQuery.chapterName = chapterName;
        if (lectureId && lectureId !== "") lectureQuery._id = lectureId;

        // Fetch official lectures
        const lectures = await Lecture.find(lectureQuery).sort({ order: 1 });

        // 2. Get the student's actual progress records
        const progressRecords = await Progress.find({ 
            courseId: courseId, 
            studentEmail: studentEmail 
        });

        // 3. Map progress data onto the lecture list to show status
        const detailedReport = lectures.map(lec => {
            const p = progressRecords.find(prog => prog.lectureId === lec._id.toString());
            
            return {
                chapterName: lec.chapterName,
                topicName: lec.topicName,
                lectureTitle: lec.title, // Maps to 'title' in your Lecture model
                isVideoCompleted: p ? p.isVideoCompleted : false,
                isQuizAttempted: p ? p.isQuizAttempted : false,
                score: p ? p.highestQuizScore : 0,
                isMastered: p ? p.isMastered : false
            };
        });

        res.json(detailedReport);
    } catch (err) {
        console.error("Admin Progress Fetch Error:", err);
        res.status(500).json({ message: "Server Error fetching student metrics" });
    }
});

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
            courseId, title, className, price, oldPrice, free,
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
            free: req.body.free,
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
        await Purchase.deleteMany({ courseId });
        await Progress.deleteMany({ courseId });
        res.json({ message: "Surgical Wipe Complete: Course, Lectures, Purchases, and Progress cleared from Galaxy." });
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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 

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
/* ================= PUBLIC COURSE DATA ================= */

router.get("/course/:courseId", async (req, res) => {
    try {
        const { courseId } = req.params;
        const course = await Course.findOne({ courseId: courseId.trim() });
        
        if (!course) {
            return res.status(404).json({ message: "Course details not found in the galaxy." });
        }
        
        res.json(course);
    } catch (err) {
        console.error("FETCH COURSE ERROR:", err);
        res.status(500).json({ message: "Server error fetching course details" });
    }
});

router.post("/trigger-reports/:courseId", adminMiddleware, async (req, res) => {
    try {
        const { courseId } = req.params;
        const students = await Enrollment.find({ courseId }); 
        const lectures = await Lecture.find({ courseId }).sort({ order: 1 });
        const course = await Course.findOne({ courseId });

        for (let student of students) {
            const progress = await Progress.find({ courseId, studentEmail: student.email });
            const doc = new PDFDocument();
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', async () => {
                let pdfBuffer = Buffer.concat(buffers);
                await sendReportEmail(student.email, pdfBuffer, student.name);
            });
            
            generateMonthlyPDF(student, course.title, reportData, finalScore, doc);
        }
        res.json({ message: "All reports dispatched!" });
    } catch (err) { res.status(500).send(err.message); }
});
// @route   GET /api/admin/download-student-report
// @desc    Generate and Download PDF Progress Report for a student
router.get("/download-student-report", auth, admin, async (req, res) => {
    try {
        const { courseId, studentEmail, chapterName } = req.query;

        // 1. Fetch Data (Same logic as fetch route)
        let lectureQuery = { courseId };
        if (chapterName) lectureQuery.chapterName = chapterName;
        
        const [course, lectures, progressRecords, student] = await Promise.all([
            Course.findOne({ courseId }),
            Lecture.find(lectureQuery).sort({ order: 1 }),
            Progress.find({ courseId, studentEmail }),
            User.findOne({ email: studentEmail })
        ]);

        if (!course || !student) return res.status(404).json({ message: "Course or Student not found" });

        // 2. Format data for PDF Service
        let vCompleted = 0;
        let totalScore = 0;
        let quizzesTaken = 0;

        const reportData = lectures.map(lec => {
            const p = progressRecords.find(prog => prog.lectureId === lec._id.toString());
            const isWatched = p ? p.isVideoCompleted : false;
            const score = p ? (p.highestQuizScore || 0) : 0;

            if (isWatched) vCompleted++;
            if (p && p.isQuizAttempted) {
                totalScore += score;
                quizzesTaken++;
            }

            return {
                title: lec.title,
                isVideoCompleted: isWatched,
                highestQuizScore: p && p.isQuizAttempted ? score : -1 // -1 flag for 'Not Attempted'
            };
        });

        // 3. Calculate Final Performance Score
        const videoPerc = (vCompleted / lectures.length) * 100;
        const quizPerc = quizzesTaken > 0 ? (totalScore / (quizzesTaken * 10)) * 100 : 0;
        const finalScore = ((videoPerc + quizPerc) / 2).toFixed(1);

        // 4. Set Headers and Stream PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Report_${student.name.replace(/\s+/g, '_')}.pdf`);

        generateMonthlyPDF(
            { name: student.name },
            course.title + (chapterName ? ` - ${chapterName}` : ""),
            reportData,
            finalScore,
            res
        );

    } catch (err) {
        console.error("PDF Admin Error:", err);
        res.status(500).send("Error generating report");
    }
});
module.exports = router;
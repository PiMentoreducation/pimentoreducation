const Purchase = require("../models/Purchase");
const Course = require("../models/Course");
const Progress = require("../models/Progress"); // Correctly imported
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. BUY COURSE LOGIC (Handles renewals and expiries)
exports.buyCourse = async (req, res) => {
    try {
        const { courseId, paymentId } = req.body;
        const cleanId = courseId.trim();
        const userId = req.user.id;

        const course = await Course.findOne({ courseId: cleanId });
        if (!course) return res.status(404).json({ message: "Course not found" });

        const now = new Date();
        let finalExpiry;

        if (course.liveValidityDate && now.getTime() <= new Date(course.liveValidityDate).getTime()) {
            finalExpiry = new Date(course.liveValidityDate);
        } else {
            finalExpiry = new Date();
            finalExpiry.setDate(finalExpiry.getDate() + (Number(course.recordedDurationDays) || 365));
        }

        const purgeDate = new Date(finalExpiry);
        purgeDate.setDate(purgeDate.getDate() + 10);

        const purchaseData = {
            userId,
            courseId: cleanId,
            title: course.title || "Untitled",
            price: course.price || 0,
            paymentId,
            className: course.className || "",
            expiryDate: finalExpiry,
            purgeAt: purgeDate
        };

        const updatedPurchase = await Purchase.findOneAndUpdate(
            { userId, courseId: cleanId },
            { $set: purchaseData },
            { upsert: true, new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Course access updated successfully",
            expiryDate: finalExpiry,
            purchase: updatedPurchase
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. GET STUDENT COURSES
exports.getMyCourses = async (req, res) => {
    try {
        const courses = await Purchase.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(courses);
    } catch (error) {
        res.status(500).json({ error: "Fetch failed" });
    }
};

// 3. AI MCQ GENERATOR (Shared with Admin routes)
exports.generateQuizWithAI = async (req, res) => {
    try {
        const { transcript } = req.body;
        if (!transcript) return res.status(400).json({ message: "Transcript required" });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            Context: ${transcript}
            Task: Generate 5 high-quality MCQs based on the context.
            Return ONLY a valid JSON array in this format:
            [{"questionText": "...", "options": ["A", "B", "C", "D"], "correctAnswerIndex": 0}]
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        // Surgical cleaning of AI response
        const text = response.text();
        const jsonMatch = text.match(/\[.*\]/s);
        if (!jsonMatch) throw new Error("AI response was not valid JSON");
        
        const quizData = JSON.parse(jsonMatch[0]);
        res.status(200).json(quizData);
    } catch (error) {
        console.error("AI Gen Error:", error);
        res.status(500).json({ message: "AI Generation Failed" });
    }
};

// 4. LEADERBOARD AGGREGATION (Competitive Rank)
exports.getCourseLeaderboard = async (req, res) => {
    try {
        const { courseId } = req.params;

        const leaderboard = await Progress.aggregate([
            { $match: { courseId: courseId } },
            {
                $group: {
                    _id: "$studentEmail",
                    name: { $first: "$studentName" },
                    masteredCount: { 
                        $sum: { $cond: [{ $eq: ["$isMastered", true] }, 1, 0] } 
                    },
                    totalScore: { $sum: "$highestQuizScore" }
                }
            },
            { $sort: { masteredCount: -1, totalScore: -1 } },
            { $limit: 10 }
        ]);
        
        res.json(leaderboard);
    } catch (err) {
        console.error("Leaderboard Error:", err);
        res.status(500).json({ message: "Leaderboard calculation failed" });
    }
};
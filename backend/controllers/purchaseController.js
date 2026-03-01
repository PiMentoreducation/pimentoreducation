const Purchase = require("../models/Purchase");
const Course = require("../models/Course");

exports.buyCourse = async (req, res) => {
    try {
        const { courseId, paymentId } = req.body;
        const course = await Course.findOne({ courseId });
        
        if (!course) return res.status(404).json({ message: "Course not found" });

        const now = new Date();
        const liveLimit = course.liveValidityDate ? new Date(course.liveValidityDate) : null;
        
        let finalExpiry;

        // --- MATH FIX: Compare Timestamps (.getTime()) ---
        if (liveLimit && now.getTime() <= liveLimit.getTime()) {
            // Priority 1: If today is BEFORE or ON the live validity date
            finalExpiry = new Date(liveLimit); 
        } else {
            // Priority 2: If today is AFTER (Recorded Phase)
            finalExpiry = new Date();
            const duration = parseInt(course.recordedDurationDays) || 365;
            finalExpiry.setDate(finalExpiry.getDate() + duration);
        }

        const purgeDate = new Date(finalExpiry);
        purgeDate.setDate(purgeDate.getDate() + 10);

        // --- THE "STRICT" SAVE ---
        const newPurchase = new Purchase({
            userId: req.user.id,
            courseId,
            title: course.title,
            price: course.price,
            paymentId,
            expiryDate: finalExpiry, // Ensure these names match Purchase.js exactly
            purgeAt: purgeDate
        });

        await newPurchase.save();
        
        console.log(`✅ [DB SYNC] Course: ${courseId} | Expiry set to: ${finalExpiry.toISOString()}`);
        res.status(201).json({ success: true, message: "Enrolled!" });

    } catch (error) {
        console.error("❌ [CONTROLLER ERROR]:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// This function MUST be here to prevent the 'argument handler' error in routes
exports.getMyCourses = async (req, res) => {
    try {
        const courses = await Purchase.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(courses);
    } catch (error) {
        console.error("GET_MY_COURSES_ERROR:", error);
        res.status(500).json({ error: "Failed to fetch your courses" });
    }
};
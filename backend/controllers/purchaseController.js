const Purchase = require("../models/Purchase");
const Course = require("../models/Course");

/**
 * PIECEWISE PURCHASE LOGIC
 * Rule 1: Purchase <= LiveDate -> Expiry = LiveDate
 * Rule 2: Purchase > LiveDate -> Expiry = Purchase + Duration
 */
exports.buyCourse = async (req, res) => {
    try {
        const { courseId, paymentId } = req.body;
        const course = await Course.findOne({ courseId });
        
        if (!course) return res.status(404).json({ message: "Course not found" });

        const now = new Date();
        const liveLimit = course.liveValidityDate ? new Date(course.liveValidityDate) : null;
        
        let finalExpiry;

        if (liveLimit && now <= liveLimit) {
            // Priority 1: Live Phase
            finalExpiry = liveLimit;
        } else {
            // Priority 2: Recorded Phase
            finalExpiry = new Date();
            const duration = parseInt(course.recordedDurationDays) || 365;
            finalExpiry.setDate(finalExpiry.getDate() + duration);
        }

        const purgeDate = new Date(finalExpiry);
        purgeDate.setDate(purgeDate.getDate() + 10);

        // DEBUG LOGS - Check these in Render Logs
        console.log(`[PURCHASE DEBUG] Course: ${courseId}`);
        console.log(`[PURCHASE DEBUG] Calculated Expiry: ${finalExpiry.toISOString()}`);

        const newPurchase = new Purchase({
            userId: req.user.id,
            courseId,
            title: course.title,
            price: course.price,
            paymentId,
            expiryDate: finalExpiry, 
            purgeAt: purgeDate       
        });

        const savedPurchase = await newPurchase.save();
        console.log("[PURCHASE DEBUG] Saved Doc ID:", savedPurchase._id);

        res.status(201).json({ success: true, message: "Enrolled successfully!" });
    } catch (error) {
        console.error("CRITICAL PURCHASE ERROR:", error);
        res.status(500).json({ message: "Server error during enrollment" });
    }
};

exports.getMyCourses = async (req, res) => {
    try {
        const courses = await Purchase.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(courses);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch courses" });
    }
};
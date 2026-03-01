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

        // --- THE PIECEWISE LOGIC ---
        if (liveLimit && now <= liveLimit) {
            // Priority 1: On or before Course Validity Date
            finalExpiry = liveLimit;
        } else {
            // Priority 2: After Course Validity Date (Purchase + Duration)
            finalExpiry = new Date();
            const duration = parseInt(course.recordedDurationDays) || 365;
            finalExpiry.setDate(finalExpiry.getDate() + duration);
        }

        const purgeDate = new Date(finalExpiry);
        purgeDate.setDate(purgeDate.getDate() + 10);

        // --- FORCE SAVE LOGIC ---
        const newPurchase = new Purchase({
            userId: req.user.id,
            courseId,
            title: course.title,
            price: course.price,
            paymentId
        });

        // Manually injecting fields to bypass any Mongoose strictness
        newPurchase.expiryDate = finalExpiry;
        newPurchase.purgeAt = purgeDate;

        await newPurchase.save();
        
        console.log(`✅ [SUCCESS] Saved Purchase for ${courseId}. Expiry: ${finalExpiry.toISOString()}`);
        res.status(201).json({ success: true, message: "Enrolled successfully!" });

    } catch (error) {
        console.error("❌ [FATAL ERROR]:", error);
        res.status(500).json({ message: "Server error during enrollment" });
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
const Purchase = require("../models/Purchase");
const Course = require("../models/Course");

/**
 * BUY COURSE LOGIC
 * Implements the Piecewise Expiry Function:
 * If PurchaseDate <= ValidityDate -> Expiry = ValidityDate
 * If PurchaseDate > ValidityDate -> Expiry = PurchaseDate + RecordedDuration
 */
exports.buyCourse = async (req, res) => {
    try {
        const { courseId, paymentId } = req.body;

        // 1. Validate Course Existence
        const course = await Course.findOne({ courseId });
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }

        const now = new Date();
        const liveLimit = course.liveValidityDate ? new Date(course.liveValidityDate) : null;
        
        let finalExpiry;

        // 2. THE PIECEWISE LOGIC (Agrona's Rule)
        if (liveLimit && now <= liveLimit) {
            // Case 1: Bought during Live/Ongoing phase
            finalExpiry = liveLimit;
        } else {
            // Case 2: Bought during Recorded phase
            finalExpiry = new Date();
            const durationDays = parseInt(course.recordedDurationDays) || 365;
            finalExpiry.setDate(finalExpiry.getDate() + durationDays);
        }

        // 3. DATABASE PURGE DATE (10 Days Grace Period for TTL Index)
        const purgeDate = new Date(finalExpiry);
        purgeDate.setDate(purgeDate.getDate() + 10);

        // 4. Create and Save Purchase Snapshot
        const newPurchase = new Purchase({
            userId: req.user.id,
            courseId,
            title: course.title,
            price: course.price, // Captures price at moment of sale
            paymentId,
            expiryDate: finalExpiry,
            purgeAt: purgeDate
        });

        await newPurchase.save();
        
        res.status(201).json({ 
            success: true, 
            message: "Enrolled successfully!",
            expiry: finalExpiry.toLocaleDateString()
        });

    } catch (error) {
        console.error("BUY_COURSE_ERROR:", error);
        res.status(500).json({ message: "Server error during enrollment" });
    }
};

/**
 * GET STUDENT COURSES
 * Fetches all purchases for the logged-in user
 */
exports.getMyCourses = async (req, res) => {
    try {
        // We fetch all, but the dashboard filter will hide expired ones
        const courses = await Purchase.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(courses);
    } catch (error) {
        console.error("GET_MY_COURSES_ERROR:", error);
        res.status(500).json({ error: "Failed to fetch your courses" });
    }
};
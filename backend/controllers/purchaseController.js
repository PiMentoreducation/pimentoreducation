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
        if (liveLimit && now <= liveLimit) {
            finalExpiry = liveLimit;
        } else {
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

        // Manually injecting fields to bypass schema strictness
        newPurchase.expiryDate = finalExpiry;
        newPurchase.purgeAt = purgeDate;

        await newPurchase.save();
        
        console.log("✅ [SUCCESS] Saved Purchase with Expiry:", finalExpiry);
        res.status(201).json({ success: true, message: "Enrolled!" });

    } catch (error) {
        console.error("❌ [FATAL ERROR]:", error);
        res.status(500).json({ message: "Server error" });
    }
};
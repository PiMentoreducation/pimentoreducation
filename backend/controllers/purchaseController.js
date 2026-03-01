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

        // Use Timestamps for absolute mathematical accuracy
        if (liveLimit && now.getTime() <= liveLimit.getTime()) {
            finalExpiry = new Date(liveLimit);
        } else {
            finalExpiry = new Date();
            const duration = parseInt(course.recordedDurationDays) || 365;
            finalExpiry.setDate(finalExpiry.getDate() + duration);
        }

        const purgeDate = new Date(finalExpiry);
        purgeDate.setDate(purgeDate.getDate() + 10);

        // --- THE "DIRECT WRITE" METHOD ---
        const newPurchase = new Purchase({
            userId: req.user.id,
            courseId,
            title: course.title,
            price: course.price,
            paymentId
        });

        // Use .set() to force these fields into the document 
        // regardless of schema strictness
        newPurchase.set('expiryDate', finalExpiry);
        newPurchase.set('purgeAt', purgeDate);

        // Force Mongoose to acknowledge these fields are "dirty" (modified)
        newPurchase.markModified('expiryDate');
        newPurchase.markModified('purgeAt');

        await newPurchase.save();
        
        console.log(`✅ [FORCE SAVE] Course: ${courseId} | Expiry: ${finalExpiry}`);
        res.status(201).json({ success: true, message: "Enrolled!" });

    } catch (error) {
        console.error("❌ [FATAL SAVE ERROR]:", error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getMyCourses = async (req, res) => {
    try {
        const courses = await Purchase.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(courses);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch" });
    }
};
// backend/controllers/purchaseController.js
const Purchase = require("../models/Purchase");
const Course = require("../models/Course");

exports.buyCourse = async (req, res) => {
    try {
        const { courseId, paymentId } = req.body;
        const cleanId = courseId.trim();
        
        const course = await Course.findOne({ courseId: cleanId });
        if (!course) return res.status(404).json({ message: "Course not found" });

        // 1. Piecewise Logic (Scalar Timestamp Comparison)
        const nowMs = Date.now();
        const liveLimitMs = course.liveValidityDate ? new Date(course.liveValidityDate).getTime() : 0;
        
        let finalExpiry;
        if (liveLimitMs > 0 && nowMs <= liveLimitMs) {
            finalExpiry = new Date(liveLimitMs);
        } else {
            finalExpiry = new Date();
            const days = parseInt(course.recordedDurationDays) || 365;
            finalExpiry.setDate(finalExpiry.getDate() + days);
        }

        const purgeDate = new Date(finalExpiry);
        purgeDate.setDate(purgeDate.getDate() + 10);

        // 2. Create and Save the BASE record
        // (This triggers your existing logic for className, price, etc.)
// 1. Create the document with all fields
        const newPurchase = new Purchase({
            userId: req.user.id,
            courseId: cleanId,
            title: course.title,
            price: course.price,
            paymentId: paymentId,
            className: course.className,
            expiryDate: finalExpiry,
            purgeAt: purgeDate
        });

        // 2. Initial Save
        const savedDoc = await newPurchase.save();

        // 3. THE GUARANTEE: Direct Update Bypass
        // Even if Step 1 fails to save the dates, this Step 3 FORCES them into Atlas.
        await Purchase.collection.updateOne(
            { _id: savedDoc._id },
            { 
                $set: { 
                    expiryDate: finalExpiry, 
                    purgeAt: purgeDate 
                } 
            }
        );

        console.log(`✅ [COMPLETE SAVE] ID: ${savedDoc._id} | Expiry: ${finalExpiry}`);
        res.status(201).json({ success: true, message: "Enrolled!" });
    } catch (error) {
        console.error("❌ PURCHASE ERROR:", error);
        res.status(500).json({ message: "Server error during enrollment" });
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
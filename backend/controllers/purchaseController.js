// backend/controllers/purchaseController.js
const Purchase = require("../models/Purchase");
// Inside purchaseController.js

const buyCourse = async (req, res) => {
    try {
        const { courseId, paymentId } = req.body;
        const course = await Course.findOne({ courseId });
        const now = new Date();
        let finalExpiry;

        // PRIORITY LOGIC
        const liveDate = new Date(course.liveValidityDate);
        if (now <= liveDate) {
            // If buying during Live/Ongoing phase
            finalExpiry = liveDate;
        } else {
            // If buying during Recorded phase
            finalExpiry = new Date();
            finalExpiry.setDate(finalExpiry.getDate() + (course.recordedDurationDays || 365));
        }

        // DATABASE PURGE DATE (10 Days Grace Period)
        const purgeDate = new Date(finalExpiry);
        purgeDate.setDate(purgeDate.getDate() + 10);

        const newPurchase = new Purchase({
            userId: req.user.id,
            courseId,
            title: course.title,
            price: course.price, 
            paymentId,
            expiryDate: finalExpiry,
            purgeAt: purgeDate
        });

        await newPurchase.save();
        res.status(201).json({ success: true, message: "Enrolled successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
exports.buyCourse = async (req, res) => {
    try {
        const { courseId, paymentId } = req.body; // 👈 Extract paymentId from frontend
        const course = await Course.findOne({ courseId });
        
        if (!course) return res.status(404).json({ message: "Course not found" });

        const now = new Date();
        const liveLimit = new Date(course.liveValidityDate);
        
        // Priority Logic: Live vs Recorded
        let finalExpiry;
        if (now <= liveLimit) {
            finalExpiry = liveLimit;
        } else {
            finalExpiry = new Date();
            finalExpiry.setDate(finalExpiry.getDate() + (course.recordedDurationDays || 365));
        }

        // Purge Date: Expiry + 10 Days
        const purgeDate = new Date(finalExpiry);
        purgeDate.setDate(purgeDate.getDate() + 10);

        const newPurchase = new Purchase({
            userId: req.user.id,
            courseId,
            title: course.title,
            price: course.price,
            paymentId, // 👈 Successfully saved to student's record
            expiryDate: finalExpiry,
            purgeAt: purgeDate
        });

        await newPurchase.save();
        res.status(201).json({ success: true, message: "Enrollment Complete" });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getMyCourses = async (req, res) => {
    try {
        const courses = await Purchase.find({ userId: req.user.id });
        res.status(200).json(courses);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch courses" });
    }
};
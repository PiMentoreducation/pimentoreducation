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
        // We take these DIRECTLY from req.body (no 'course' wrapper)
        const { paymentId, courseId, title, className, price } = req.body;
        
        // Debugging: This will show in your VS Code terminal
        console.log("Saving Course ID:", courseId);

        const newPurchase = new Purchase({
            userId: req.user.id, // Successfully fixed by your new middleware!
            courseId,            // Simplified ES6 syntax
            title,
            className,
            price,
            paymentId,
            createdAt: new Date(),
            expiryDate: expiry, // This will now save correctly because of Step 1
        });

        await newPurchase.save();
        res.status(201).json({ message: "Purchase successful" });
    } catch (error) {
        console.error("Purchase Save Error:", error);
        res.status(500).json({ error: "Failed to save purchase" });
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
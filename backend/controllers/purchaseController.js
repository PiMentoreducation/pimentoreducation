// backend/controllers/purchaseController.js
const Purchase = require("../models/Purchase");
// Inside purchaseController.js

const buyCourse = async (req, res) => {
    try {
        const { courseId, paymentId } = req.body;
        const userId = req.user.id;

        // 1. Fetch the course to get its 'validityDays' (Step 1)
        const course = await Course.findOne({ courseId });
        if (!course) return res.status(404).json({ message: "Course not found" });

        // 2. Calculate the Expiry Date (The Math: Current Date + X Days)
        const expiryDate = new Date();
        // If validityDays isn't set, default to 365
        const daysToAdd = course.validityDays || 365; 
        expiryDate.setDate(expiryDate.getDate() + daysToAdd);

        // 3. Create the Purchase record
        const newPurchase = new Purchase({
            userId,
            courseId: course.courseId,
            title: course.title,
            className: course.className,
            price: course.price,
            paymentId,
            createdAt: new Date(), // FIX: This solves "Invalid Date"
            expiryDate: expiryDate  // NEW: This handles the expiration
        });

        await newPurchase.save();
        res.status(201).json({ success: true, message: "Course purchased successfully!" });

    } catch (error) {
        res.status(500).json({ message: "Error processing purchase" });
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
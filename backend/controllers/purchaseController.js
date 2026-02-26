// backend/controllers/purchaseController.js
const Purchase = require("../models/Purchase");

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
            paymentId
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
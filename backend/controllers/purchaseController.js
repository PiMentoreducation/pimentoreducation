const Purchase = require("../models/Purchase");
const Course = require("../models/Course");
const mongoose = require("mongoose");

exports.buyCourse = async (req, res) => {
    try {
        const { courseId, paymentId } = req.body;
        const cleanId = courseId.trim();
        
        // 1. Get raw course data
        const course = await Course.findOne({ courseId: cleanId }).lean();
        if (!course) return res.status(404).json({ message: "Course not found" });

        // 2. Piecewise Logic
        const now = new Date();
        const liveLimit = course.liveValidityDate ? new Date(course.liveValidityDate) : null;
        let finalExpiry;

        if (liveLimit && !isNaN(liveLimit.getTime()) && now.getTime() <= liveLimit.getTime()) {
            finalExpiry = new Date(liveLimit.getTime());
        } else {
            finalExpiry = new Date();
            const days = parseInt(course.recordedDurationDays) || 365;
            finalExpiry.setDate(finalExpiry.getDate() + days);
        }

        const purgeDate = new Date(finalExpiry.getTime() + (10 * 24 * 60 * 60 * 1000));

        // 3. DIRECT DRIVER INSERT (The Nuclear Option)
        const rawData = {
            userId: new mongoose.Types.ObjectId(req.user.id),
            courseId: cleanId,
            title: course.title || "Untitled",
            price: course.price || 0,
            paymentId: paymentId,
            className: course.className || "",
            expiryDate: finalExpiry,
            purgeAt: purgeDate,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await mongoose.connection.collection('purchases').insertOne(rawData);

        // DEBUG LOGS - Check these in Render!
        console.log("-----------------------------------------");
        console.log(`DB NAME: ${mongoose.connection.db.databaseName}`);
        console.log(`COLLECTION: purchases`);
        console.log(`INSERTED_ID: ${result.insertedId}`);
        console.log(`EXPIRY_SAVED: ${finalExpiry.toISOString()}`);
        console.log("-----------------------------------------");

        res.status(201).json({ 
            success: true, 
            db: mongoose.connection.db.databaseName,
            expiry: finalExpiry.toISOString() 
        });

    } catch (error) {
        console.error("CRITICAL_ERROR:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getMyCourses = async (req, res) => {
    try {
        const courses = await Purchase.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(courses);
    } catch (error) {
        res.status(500).json({ error: "Fetch failed" });
    }
};
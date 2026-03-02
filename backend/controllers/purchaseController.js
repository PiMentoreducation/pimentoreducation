const Purchase = require("../models/Purchase");
const Course = require("../models/Course");

exports.buyCourse = async (req, res) => {
    try {
        const { courseId, paymentId } = req.body;
        const cleanId = courseId.trim();

        // 1️⃣ Find Course
        const course = await Course.findOne({ courseId: cleanId });
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }

        // 2️⃣ Prevent Duplicate Purchase
        const alreadyPurchased = await Purchase.findOne({
            userId: req.user.id,
            courseId: cleanId
        });

        if (alreadyPurchased) {
            return res.status(400).json({ message: "Course already purchased" });
        }

        // 3️⃣ Calculate Expiry Logic
        const now = new Date();
        let finalExpiry;

        if (
            course.liveValidityDate &&
            now.getTime() <= new Date(course.liveValidityDate).getTime()
        ) {
            // Live batch access
            finalExpiry = new Date(course.liveValidityDate);
        } else {
            // Recorded access
            finalExpiry = new Date();
            finalExpiry.setDate(
                finalExpiry.getDate() + (course.recordedDurationDays || 365)
            );
        }

        // 4️⃣ Purge Date (10 days after expiry)
        const purgeDate = new Date(finalExpiry);
        purgeDate.setDate(purgeDate.getDate() + 10);

        // 5️⃣ SAVE USING MONGOOSE (CORRECT WAY)
        const newPurchase = new Purchase({
            userId: req.user.id,
            courseId: cleanId,
            title: course.title || "Untitled",
            price: course.price || 0,
            paymentId,
            className: course.className || "",
            expiryDate: finalExpiry,
            purgeAt: purgeDate
        });

        await newPurchase.save();

        res.status(201).json({
            success: true,
            message: "Course purchased successfully",
            expiryDate: finalExpiry
        });

    } catch (error) {
        console.error("BUY COURSE ERROR:", error);
        res.status(500).json({ error: error.message });
    }
};

// Fetch student's purchased courses
exports.getMyCourses = async (req, res) => {
    try {
        const courses = await Purchase.find({
            userId: req.user.id
        }).sort({ createdAt: -1 });

        res.status(200).json(courses);
    } catch (error) {
        res.status(500).json({ error: "Fetch failed" });
    }
};
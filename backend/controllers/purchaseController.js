// backend/controllers/purchaseController.js
const Purchase = require("../models/Purchase");
const Course = require("../models/Course");

exports.buyCourse = async (req, res) => {
    try {
        const { courseId, paymentId } = req.body;
        const cleanId = courseId.trim();
        
        const course = await Course.findOne({ courseId: cleanId });
        if (!course) return res.status(404).json({ message: "Course not found" });

        // 1. STRENGTHENED DATE PARSING
        const now = new Date();
        const liveLimit = course.liveValidityDate ? new Date(course.liveValidityDate) : null;
        
        let finalExpiry;

        // Verify if liveLimit is a valid date before comparing
        if (liveLimit && !isNaN(liveLimit.getTime()) && now.getTime() <= liveLimit.getTime()) {
            finalExpiry = new Date(liveLimit);
        } else {
            finalExpiry = new Date();
            // Fallback to 365 if recordedDurationDays is missing or 0
            const duration = parseInt(course.recordedDurationDays) || 365;
            finalExpiry.setDate(finalExpiry.getDate() + duration);
        }

        // 2. ENSURE VALUES ARE VALID
        if (isNaN(finalExpiry.getTime())) {
            finalExpiry = new Date();
            finalExpiry.setFullYear(finalExpiry.getFullYear() + 1); // Safety fallback: 1 year from now
        }

        const purgeDate = new Date(finalExpiry);
        purgeDate.setDate(purgeDate.getDate() + 10);

        // 3. THE ATOMIC SAVE
        const newPurchase = new Purchase({
            userId: req.user.id,
            courseId: cleanId,
            title: course.title,
            price: course.price,
            paymentId,
            className: course.className
        });

        const savedDoc = await newPurchase.save();

        // 4. BYPASS ENTIRE SCHEMATIC LAYER
        // We use the raw MongoDB driver to ensure no Mongoose interference
        await Purchase.collection.updateOne(
            { _id: savedDoc._id },
            { 
                $set: { 
                    expiryDate: finalExpiry, 
                    purgeAt: purgeDate 
                } 
            }
        );

        console.log(`✅ [CRITICAL SUCCESS] ID: ${savedDoc._id} | Expiry: ${finalExpiry}`);
        res.status(201).json({ success: true, message: "Enrolled!" });

    } catch (error) {
        console.error("❌ CRITICAL PURCHASE ERROR:", error);
        res.status(500).json({ message: "Server error" });
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
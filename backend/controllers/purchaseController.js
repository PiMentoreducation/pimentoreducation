// backend/controllers/purchaseController.js
const Purchase = require("../models/Purchase");
const Course = require("../models/Course");

exports.buyCourse = async (req, res) => {
    try {
        const { courseId, paymentId } = req.body;
        
        // 1. Find the course (Trimmed to prevent space-matching errors)
        const course = await Course.findOne({ courseId: courseId.trim() });
        if (!course) return res.status(404).json({ message: "Course not found" });

        // 2. Piecewise Logic (Scalar Timestamp Comparison)
        const nowTime = Date.now();
        // Ensure we handle the specific ISO format from your DB
        const liveLimitTime = course.liveValidityDate ? new Date(course.liveValidityDate).getTime() : null;
        
        let finalExpiry;
        if (liveLimitTime && nowTime <= liveLimitTime) {
            // Priority: Enrollment happens during the Live phase
            finalExpiry = new Date(liveLimitTime);
        } else {
            // Enrollment happens during the Recorded phase
            finalExpiry = new Date();
            const duration = parseInt(course.recordedDurationDays) || 365;
            finalExpiry.setDate(finalExpiry.getDate() + duration);
        }

        const purgeDate = new Date(finalExpiry);
        purgeDate.setDate(purgeDate.getDate() + 10);

        // 3. Create the basic purchase document
        const newPurchase = new Purchase({
            userId: req.user.id,
            courseId: courseId.trim(),
            title: course.title,
            price: course.price,
            paymentId,
            className: course.className 
        });

        const savedDoc = await newPurchase.save();

        // 4. THE BYPASS: Direct MongoDB Driver Update
        // This forces the fields into Atlas regardless of Mongoose schema cache
        await Purchase.collection.updateOne(
            { _id: savedDoc._id },
            { 
                $set: { 
                    expiryDate: finalExpiry, 
                    purgeAt: purgeDate 
                } 
            }
        );

        console.log(`✅ [DIRECT-WRITE] Saved ${courseId}. Expiry: ${finalExpiry.toISOString()}`);
        res.status(201).json({ success: true, message: "Enrolled!" });

    } catch (error) {
        console.error("❌ PURCHASE ERROR:", error);
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
};gi
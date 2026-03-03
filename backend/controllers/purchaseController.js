const Purchase = require("../models/Purchase");
const Course = require("../models/Course");

exports.buyCourse = async (req, res) => {
    try {
        const { courseId, paymentId } = req.body;
        const cleanId = courseId.trim();
        const userId = req.user.id;

        // 1️⃣ Find Course to get validity rules
        const course = await Course.findOne({ courseId: cleanId });
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }

        // 2️⃣ Calculate New Expiry Logic
        const now = new Date();
        let finalExpiry;

        if (
            course.liveValidityDate &&
            now.getTime() <= new Date(course.liveValidityDate).getTime()
        ) {
            // Live batch access: Set to specific fixed date
            finalExpiry = new Date(course.liveValidityDate);
        } else {
            // Recorded access: Set to Current Date + Duration Days
            finalExpiry = new Date();
            finalExpiry.setDate(
                finalExpiry.getDate() + (Number(course.recordedDurationDays) || 365)
            );
        }

        // 3️⃣ Purge Date (10 days after expiry for TTL cleanup)
        const purgeDate = new Date(finalExpiry);
        purgeDate.setDate(purgeDate.getDate() + 10);

        // 4️⃣ UPSERT LOGIC (The Renewal Fix)
        // If (userId + courseId) exists, UPDATE it. If not, CREATE it.
        const purchaseData = {
            userId: userId,
            courseId: cleanId,
            title: course.title || "Untitled",
            price: course.price || 0,
            paymentId: paymentId,
            className: course.className || "",
            expiryDate: finalExpiry,
            purgeAt: purgeDate
        };

        const updatedPurchase = await Purchase.findOneAndUpdate(
            { userId: userId, courseId: cleanId }, // Search criteria
            { $set: purchaseData },                // Data to update
            { 
                upsert: true,                      // Create if doesn't exist
                new: true,                         // Return the updated doc
                runValidators: true 
            }
        );

        res.status(200).json({
            success: true,
            message: "Course access updated successfully",
            expiryDate: finalExpiry,
            purchase: updatedPurchase
        });

    } catch (error) {
        console.error("BUY/RENEW COURSE ERROR:", error);
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
        console.error("FETCH COURSES ERROR:", error);
        res.status(500).json({ error: "Fetch failed" });
    }
};
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const razorpay = require("../utils/razorpay");
const { buyCourse } = require("../controllers/purchaseController");
const Course = require("../models/Course");

/* ================= CREATE ORDER ================= */
router.post("/create-order", auth, async (req, res) => {
  const { courseId } = req.body;

  try {
    const course = await Course.findOne({ courseId: String(courseId).trim() });

    if (!course) {
      console.error("Order creation failed: Course not found for ID:", courseId);
      return res.status(404).json({ message: "Course not found in database" });
    }

    const options = {
      amount: Math.round(Number(course.price) * 100),
      currency: "INR",
      receipt: `rcpt_${courseId.substring(0, 10)}_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    res.json({ order });

  } catch (err) {
    console.error("Order creation failed:", err);
    res.status(500).json({ message: "Failed to create order" });
  }
});

/* ================= VERIFY PAYMENT / FREE ENROLLMENT ================= */
router.post("/verify", auth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      isFreePurchase, // 🔥 New flag from frontend
      course 
    } = req.body;

    // 1. Handle Free Enrollment Bypass
    if (isFreePurchase === true) {
      const dbCourse = await Course.findOne({ courseId: String(course.courseId).trim() });

      if (!dbCourse) {
        return res.status(404).json({ message: "Course not found" });
      }

      // 🛡️ SECURITY CHECK: Ensure the course is actually marked as free in DB
      if (dbCourse.free !== "yes") {
        return res.status(403).json({ message: "Security Alert: This course is not free." });
      }

      // Prepare body for purchaseController without Razorpay details
      req.body = {
        courseId: dbCourse.courseId,
        title: dbCourse.title,
        className: dbCourse.className,
        price: 0, // It's free
        liveValidityDate: dbCourse.liveValidityDate,
        recordedDurationDays: dbCourse.recordedDurationDays,
        paymentId: "FREE_ENROLLMENT_" + Date.now() // Internal placeholder ID
      };

      return buyCourse(req, res);
    }

    // 2. Standard Razorpay Signature Verification (for Paid courses)
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed: Signature Mismatch" });
    }

    // 3. Fetch course details for Paid course
    const dbCourse = await Course.findOne({ courseId: String(course.courseId).trim() });

    if (!dbCourse) {
      return res.status(404).json({ message: "Database update failed: Course record lost" });
    }

    // 4. Prepare body for Paid Purchase
    req.body = {
      courseId: dbCourse.courseId,
      title: dbCourse.title,
      className: dbCourse.className,
      price: dbCourse.price,
      liveValidityDate: dbCourse.liveValidityDate,
      recordedDurationDays: dbCourse.recordedDurationDays,
      paymentId: razorpay_payment_id
    };

    return buyCourse(req, res);

  } catch (error) {
    console.error("VERIFY ERROR:", error);
    res.status(500).json({ message: "Internal Server Error during verification" });
  }
});

module.exports = router;
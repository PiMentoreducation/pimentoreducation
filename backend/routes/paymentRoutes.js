const express = require("express");
const crypto = require("crypto");
const router = express.Router(); // ✅ MUST exist

const auth = require("../middleware/authMiddleware");
const razorpay = require("../utils/razorpay");
const { buyCourse } = require("../controllers/purchaseController");

/* ================= CREATE ORDER ================= */
router.post("/create-order", auth, async (req, res) => {
  const { courseId, price } = req.body;

  try {
    const order = await razorpay.orders.create({
      amount: price * 100,
      currency: "INR",
      receipt: `rcpt_${courseId}_${Date.now()}`
    });

    res.json({ order });
  } catch (err) {
    console.error("Order creation failed:", err);
    res.status(500).json({ message: "Failed to create order" });
  }
});

/* ================= VERIFY PAYMENT ================= */
router.post("/verify", auth, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      course
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Forward to purchase controller
    req.body = {
      courseId: course.courseId,
      paymentId: razorpay_payment_id
    };

    return buyCourse(req, res);

  } catch (error) {
    console.error("VERIFY ERROR:", error);
    res.status(500).json({ message: "Payment verification failed" });
  }
});

module.exports = router;
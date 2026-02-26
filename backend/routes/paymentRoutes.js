const express = require("express");
const crypto = require("crypto");
const router = express.Router(); // ✅ THIS WAS MISSING

const auth = require("../middleware/authMiddleware");
const razorpay = require("../utils/razorpay");
const Purchase = require("../models/Purchase");

/* ================= CREATE ORDER ================= */
router.post("/create-order", auth, async (req, res) => {
  const { courseId, title, price, className } = req.body;

  try {
    const order = await razorpay.orders.create({
      amount: price * 100,
      currency: "INR",
      receipt: `rcpt_${courseId}`
    });

    res.json({ order });
  } catch (err) {
    console.error("Order creation failed:", err);
    res.status(500).json({ message: "Failed to create order" });
  }
});

/* ================= VERIFY PAYMENT ================= */
router.post("/verify", auth, async (req, res) => {
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

  // ✅ Save purchase ONLY here
  await Purchase.create({
    userId: req.user.id,
    courseId: course.courseId,
    title: course.title,
    className: course.className,
    price: course.price,
    paymentId: razorpay_payment_id
  });

  res.json({ message: "Payment successful, course unlocked" });
});

module.exports = router;
const { buyCourse } = require("../controllers/purchaseController");

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

    // ✅ Forward to buyCourse controller
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
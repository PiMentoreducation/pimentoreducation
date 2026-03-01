const mongoose = require("mongoose");
const purchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  courseId: String,
  title: String,
  price: Number,
  paymentId: String, // 👈 Captured for transaction tracking
  expiryDate: { type: Date },
  purgeAt: { type: Date } 
}, { timestamps: true });

purchaseSchema.index({ "purgeAt": 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Purchase", purchaseSchema);
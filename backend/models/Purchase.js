const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  courseId: { type: String, trim: true },
  title: String,
  price: Number,
  paymentId: String,
  className: String,
  expiryDate: { type: Date, required: true },
  purgeAt: { type: Date, required: true }
}, { 
  timestamps: true
});

// TTL Auto delete after purgeAt time
purchaseSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);
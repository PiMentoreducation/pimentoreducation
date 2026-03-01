const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  courseId: { type: String, trim: true },
  title: String,
  price: Number,
  paymentId: String,
  className: String,
  expiryDate: { type: Date }, 
  purgeAt: { type: Date }
}, { 
  timestamps: true,
  strict: false 
});

// Force index for auto-deletion
purchaseSchema.index({ "purgeAt": 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);
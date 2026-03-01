const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  courseId: String,
  title: String,
  className: String,
  price: Number,
  paymentId: String,
  // Add this field explicitly
  expiryDate: { type: Date } 
}, { 
  // This automatically creates 'createdAt' (Enrolled Date) and 'updatedAt'
  timestamps: true 
});

module.exports = mongoose.model("Purchase", purchaseSchema);
const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  courseId: String,
  title: String,
  className: String,
  price: Number,
  paymentId: String,
  expiryDate: { type: Date } // We keep this for your "Resale" logic
}, { 
  timestamps: true // 👈 This automatically creates 'createdAt' and 'updatedAt'
});

module.exports = mongoose.model("Purchase", purchaseSchema);
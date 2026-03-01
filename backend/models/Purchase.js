const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  courseId: String,
  title: String,
  price: Number,
  paymentId: String, // Critical for tracking
  expiryDate: { type: Date }, // Actual access cutoff
  purgeAt: { type: Date }    // Expiry + 10 days (Auto-delete trigger)
}, { 
  timestamps: true // This auto-generates createdAt for your joined date
});

// TTL INDEX: This is the "Garbage Collector"
// It deletes the record from MongoDB when current time matches 'purgeAt'
purchaseSchema.index({ "purgeAt": 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Purchase", purchaseSchema);
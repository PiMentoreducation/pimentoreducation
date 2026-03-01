const purchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  courseId: String,
  title: String,
  price: Number, // Captures price at moment of sale
  expiryDate: { type: Date }, // Actual access end
  purgeAt: { type: Date } // Expiry + 10 days (Auto-delete trigger)
}, { timestamps: true });

// TTL INDEX: MongoDB deletes doc when current time matches 'purgeAt'
purchaseSchema.index({ "purgeAt": 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Purchase", purchaseSchema);
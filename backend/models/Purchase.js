const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  courseId: String,
  title: String,
  className: String,
  price: Number,
  paymentId: String
});

module.exports = mongoose.model("Purchase", purchaseSchema);
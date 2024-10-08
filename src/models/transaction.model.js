import { Schema, model } from "mongoose";

const transactionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  razorpay_order_id: {
    type: String,
    required: true,
    unique: true,
  },
  razorpay_payment_id: {
    type: String,
    required: true,
    unique: true,
  },
  razorpay_signature: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ["processing", "success", "failed"],
    default: "processing",
  },
  processedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Transactions = model("Transaction", transactionSchema);
export default Transactions;

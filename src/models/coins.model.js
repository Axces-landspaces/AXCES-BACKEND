// coins.model.js
import mongoose from "mongoose";

const CoinsSchema = new mongoose.Schema({
  userId: {
    type: String,
    ref: "User",
    required: true,
    unique: true,
  },
  balance: {
    type: Number,
    default: 200,
  },
  defaultPropertyPostCost: {
    type: Number,
    default: 10,
  },
  defaultOwnerDetailsCost: {
    type: Number,
    default: 10,
  },
  transactions: [
    {
      transaction_id: {
        type: String,
        unique: true,
      },
      amount: {
        type: Number,
      },
      razorpay_payment_id: {
        type: String,
      },
      type: {
        type: String,
        enum: ["credit", "debit", "refund", "failed"],
        required: true,
      },
      description: {
        type: String,
        enum: [
          "property_post",
          "owner_details",
          "coin_recharge",
          "failed_transaction",
          "service_cancellation",
          "referral_bonus",
        ],
        required: true,
      },
      balanceAfterDeduction: {
        type: Number,
      },
      recharge_method: {
        type: String,
        enum: ["upi", "card", "netbanking", "wallet", "debit", "credit", "appleIAP"],
      },
      download_invoice_url: {
        type: String,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

const Coins = mongoose.model("Coins", CoinsSchema);

export default Coins;

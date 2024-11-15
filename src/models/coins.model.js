// coins.model.js
import mongoose from "mongoose";

// this gonna have one to one relationship with user
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
      amount: {
        type: Number,
        required: true,
      },
      razorpay_payment_id: {
        type: String,
        // required: true,
      },
      type: {
        type: String,
        enum: ["credit", "debit"],
        required: true,
      },
      description: {
        type: String,
        enum: ["property_post", "owner_details", "coin_recharge"],
        required: true,
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

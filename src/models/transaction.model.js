import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
  },
  paymentId: {
    type: String,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["processing", "success", "failed"],
    default: "processing",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
  },
});

// Pre-save hook to set expiresAt
TransactionSchema.pre("save", function (next) {
  if (this.isNew) {
    this.expiresAt = new Date(Date.now() + 1 * 60 * 1000); // 15 minutes from now
  }
  next();
});

// Define a static method to update expired transactions
TransactionSchema.statics.updateExpired = async function () {
  const now = new Date();
  await this.updateMany(
    {
      status: "processing",
      expiresAt: { $lte: now },
    },
    {
      $set: { status: "failed" },
    }
  );
};

// Create a background task to periodically update expired transactions
setInterval(async () => {
  try {
    await Transactions.updateExpired();
    console.log("Updated expired transactions");
  } catch (error) {
    console.error("Error updating expired transactions:", error);
  }
}, 1 * 60 * 1000); // Run every 5 minutes

export const Transactions = mongoose.model("Transaction", TransactionSchema);

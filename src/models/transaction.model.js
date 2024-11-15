import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  paymentId: {
    type: String,
    sparse: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: ["processing", "success", "failed"],
    default: "processing",
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  expiresAt: {
    type: Date,
    index: true,
  },
});

// Pre-save hook to set expiresAt
TransactionSchema.pre("save", function (next) {
  if (this.isNew) {
    this.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  }
  next();
});

// Define a static method to update expired transactions
TransactionSchema.statics.updateExpired = async function () {
  const now = new Date();
  const result = await this.updateMany(
    {
      status: "processing",
      expiresAt: { $lte: now },
    },
    {
      $set: {
        status: "failed",
        failureReason: "expired",
      },
    }
  );

  return result.modifiedCount; 
};

// Create a function to start the background task
let intervalId = null;

export const startExpiryCheck = () => {
  if (intervalId) return; 
  intervalId = setInterval(async () => {
    try {
      const updatedCount = await Transactions.updateExpired();
      if (updatedCount > 0) {
        console.log(`Updated ${updatedCount} expired transactions`);
      }
    } catch (error) {
      console.error("Error updating expired transactions:", error);
    }
  }, 5 * 60 * 1000); 
};

// Create a function to stop the background task
export const stopExpiryCheck = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

// Add method to manually check specific transaction
TransactionSchema.methods.checkExpiry = async function () {
  if (this.status === "processing" && this.expiresAt <= new Date()) {
    this.status = "failed";
    this.failureReason = "expired";
    await this.save();
    return true;
  }
  return false;
};

export const Transactions = mongoose.model("Transaction", TransactionSchema);

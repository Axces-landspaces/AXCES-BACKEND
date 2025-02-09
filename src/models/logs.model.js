// Desc: Logs model for storing logs of user actions
import { Schema, model } from "mongoose";
const LogsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    logData: {
      type: Object,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: ["captured"],
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
  },
  {
    timestamps: true,
  }
);

const Logs = model("Logs", LogsSchema);
export default Logs;
